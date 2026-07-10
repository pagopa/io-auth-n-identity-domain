import {
  BulkOperationType,
  Container,
  CosmosClient,
  JSONObject,
  OperationInput,
} from "@azure/cosmos";
import {
  ConflictError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";

import type { SessionMetadata } from "../../domain/entities/session-metadata.entity.js";
import { SessionMetadataSchema } from "../../domain/entities/session-metadata.entity.js";
import { SessionSchema } from "../../domain/entities/session.entity.js";
import type {
  Session,
  SessionWithHashedSSOTokens,
} from "../../domain/entities/session.entity.js";
import { SessionPort } from "../../domain/ports/outbound/session.port.js";
import type { HashedBpdSSOTokenWithSessionTrackingId } from "../../domain/value-objects/tokens/bpd-sso-token.vo.js";
import type { HashedBpdSSOToken } from "../../domain/value-objects/tokens/bpd-sso-token.vo.js";
import type { HashedFimsSSOToken } from "../../domain/value-objects/tokens/fims-sso-token.vo.js";
import type {
  HashedSessionToken,
  HashedSessionTokenWithTrackingId,
} from "../../domain/value-objects/tokens/session-token.vo.js";
import { HashedSessionTokenWithTrackingIdSchema } from "../../domain/value-objects/tokens/session-token.vo.js";
import type { HashedWalletSSOToken } from "../../domain/value-objects/tokens/wallet-sso-token.vo.js";
import type { HashedZendeskSSOToken } from "../../domain/value-objects/tokens/zendesk-sso-token.vo.js";

import { CosmosBaseAdapter } from "./cosmos-base.adapter.js";

// ---------------------------------------------------------------------------
// Cosmos DB Document ID Prefixes
// ---------------------------------------------------------------------------

const COSMOS_SESSION_PREFIX = "SESSION-";
const COSMOS_WALLET_PREFIX = "WALLET-";
const COSMOS_BPD_PREFIX = "BPD-";
const COSMOS_FIMS_PREFIX = "FIMS-";
const COSMOS_ZENDESK_PREFIX = "ZENDESK-";
const COSMOS_SESSION_METADATA_ID = "SESSION_METADATA";

// ---------------------------------------------------------------------------
// Cosmos DB Adapter for SessionPort
// ---------------------------------------------------------------------------

export class SessionCosmosAdapter
  extends CosmosBaseAdapter
  implements SessionPort
{
  protected readonly userSessionContainer: Container;
  protected readonly sessionMetadataContainer: Container;

  constructor(
    client: CosmosClient,
    databaseId: string,
    userSessionContainerId: string,
    sessionMetadataContainerId: string,
  ) {
    super(client);

    this.userSessionContainer = this.client
      .database(databaseId)
      .container(userSessionContainerId);
    this.sessionMetadataContainer = this.client
      .database(databaseId)
      .container(sessionMetadataContainerId);
  }

  public async findBySessionToken(
    sessionToken: HashedSessionTokenWithTrackingId,
  ): Promise<Result<Session, GenericError | NotFoundError>> {
    const { sessionTrackingId, hashedSessionToken } = sessionToken;
    const result = await this.readItem(
      this.userSessionContainer,
      toCosmosSessionId(hashedSessionToken),
      sessionTrackingId as unknown as NonEmptyString,
      "UserSession" as NonEmptyString,
    );
    return result.andThen(fromDbSession);
  }

  public async findByBpdToken(
    bpdToken: HashedBpdSSOTokenWithSessionTrackingId,
  ): Promise<Result<Session, GenericError | NotFoundError>> {
    const result = await this.readItem(
      this.userSessionContainer,
      toCosmosBpdSessionId(bpdToken.hashedToken),
      bpdToken.sessionTrackingId as unknown as NonEmptyString,
      "UserSession" as NonEmptyString,
    );
    return result.andThen(fromDbSession);
  }

  public async create(
    sessionMetadata: SessionMetadata,
    session: SessionWithHashedSSOTokens,
  ): Promise<Result<SessionWithHashedSSOTokens, ConflictError | GenericError>> {
    // First create the volatile user session in the userSessionContainer, which will expire after TTL.
    const sessionCreationResult = await this.createUserSession(session);
    if (sessionCreationResult.isErr()) {
      return sessionCreationResult;
    }

    // Then create the session metadata in the sessionMetadataContainer, which will also expire after its TTL,
    // which it can be different from the user session TTL, depending on the login type.
    const sessionMetadataCreationResult =
      await this.createSessionMetadata(sessionMetadata);
    if (sessionMetadataCreationResult.isErr()) {
      // If an error occurs during the creation of the user metadata,
      // the userSession will be left orphaned in the userSessionContainer and will expire after TTL.
      return err(sessionMetadataCreationResult.error);
    }

    return ok(session);
  }

  public async refresh(
    session: SessionWithHashedSSOTokens,
  ): Promise<Result<SessionWithHashedSSOTokens, ConflictError | GenericError>> {
    const result = await this.createUserSession(session);
    if (result.isErr()) {
      return result;
    }

    return ok(session);
  }

  public async delete(
    sessionTokens: SessionWithHashedSSOTokens,
  ): Promise<Result<void, GenericError | NotFoundError>> {
    // First delete the SessionMetadata, since fiscalCode is needed
    //  to perform the deletion.
    const deleteUserSessionResult = await this.deleteSessionMetadata(
      sessionTokens.fiscalCode,
    );
    if (deleteUserSessionResult.isErr()) {
      return deleteUserSessionResult;
    }

    // Then delete the user session in the userSessionContainer
    // If an error occurs during the deletion of the user session,
    // the request can be retried
    const deleteSessionInfoResult = await this.deleteUserSession(sessionTokens);
    if (deleteSessionInfoResult.isErr()) {
      return deleteSessionInfoResult;
    }

    return ok(void 0);
  }

  public async invalidatePreviousSession(
    fiscalCode: FiscalCode,
  ): Promise<
    Result<HashedSessionTokenWithTrackingId | undefined, GenericError>
  > {
    try {
      // Step 1: read the SessionMetadata for the given fiscalCode to get the sessionTrackingId
      const sessionMetadataResult = await this.getSessionMetadata(fiscalCode);

      if (sessionMetadataResult.isErr()) {
        if (sessionMetadataResult.error instanceof NotFoundError) {
          // no previous session to invalidate
          return ok(undefined);
        }
        return err(sessionMetadataResult.error);
      }

      const sessionTrackingId = sessionMetadataResult.value.sessionTrackingId;

      // Step 2: delete all token items in userSessionContainer for that sessionTrackingId
      const { resources: items } = await this.userSessionContainer.items
        .query(
          { query: "SELECT c.id FROM c" },
          { partitionKey: sessionTrackingId },
        )
        .fetchAll();

      // Extract the hashed session token from the SESSION- item before deleting
      const sessionItem = items.find((item: { id: string }) =>
        item.id.startsWith(COSMOS_SESSION_PREFIX),
      );
      const hashedSessionToken = sessionItem
        ? String(sessionItem.id).replace(COSMOS_SESSION_PREFIX, "")
        : undefined;

      if (items.length > 0) {
        const deleteOps: OperationInput[] = items.map(
          (item: { id: string }) => ({
            operationType: BulkOperationType.Delete,
            id: item.id,
            partitionKey: sessionTrackingId,
          }),
        );

        const deleteResult =
          await this.userSessionContainer.items.executeBulkOperations(
            deleteOps,
          );

        for (const res of deleteResult) {
          if (
            // Avoid returning an error for successes or not found items
            res.response?.statusCode !== 200 &&
            res.response?.statusCode !== 204 &&
            res.response?.statusCode !== 404 &&
            res.response !== undefined
          ) {
            return err(
              new GenericError(
                `Error deleting user session. Status code: ${res.response?.statusCode}`,
              ),
            );
          }
        }
      }

      // Step 3: delete SessionMetadata
      await this.sessionMetadataContainer
        .item(COSMOS_SESSION_METADATA_ID, fiscalCode)
        .delete();

      if (hashedSessionToken) {
        const parsed = HashedSessionTokenWithTrackingIdSchema.safeParse({
          sessionTrackingId,
          hashedSessionToken,
        });

        if (parsed.success) {
          return ok(parsed.data);
        }

        return err(
          new GenericError(
            `Error parsing invalidated session token: ${parsed.error.message}`,
          ),
        );
      }

      return ok(undefined);
    } catch (error) {
      return this.handleCosmosError(
        error,
        "UserSession" as NonEmptyString,
        "invalidatePreviousSession" as NonEmptyString,
      ).mapErr((e) =>
        e instanceof ConflictError ? new GenericError(e.message) : e,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private async getSessionMetadata(
    fiscalCode: FiscalCode,
  ): Promise<Result<SessionMetadata, GenericError | NotFoundError>> {
    const result = await this.readItem(
      this.sessionMetadataContainer,
      COSMOS_SESSION_METADATA_ID as NonEmptyString,
      fiscalCode as unknown as NonEmptyString,
      "SessionMetadata" as NonEmptyString,
    );
    return result.andThen(fromDbSessionMetadata);
  }

  private async createUserSession(
    userSessionToCreate: SessionWithHashedSSOTokens,
  ): Promise<Result<SessionWithHashedSSOTokens, ConflictError | GenericError>> {
    const ttlResult = this.computeTtl(userSessionToCreate.expirationDate);

    if (ttlResult.isErr()) {
      return err(ttlResult.error);
    }
    const ttl = ttlResult.value;

    try {
      const result = await this.userSessionContainer.items.batch(
        [
          {
            operationType: BulkOperationType.Create,
            resourceBody: toDbSession(userSessionToCreate, ttl),
          },
          {
            operationType: BulkOperationType.Create,
            resourceBody: toDbWalletUserSession(userSessionToCreate, ttl),
          },
          {
            operationType: BulkOperationType.Create,
            resourceBody: toDbBpdUserSession(userSessionToCreate, ttl),
          },
          {
            operationType: BulkOperationType.Create,
            resourceBody: toDbFimsUserSession(userSessionToCreate, ttl),
          },
          {
            operationType: BulkOperationType.Create,
            resourceBody: toDbZendeskUserSession(userSessionToCreate, ttl),
          },
        ],
        userSessionToCreate.hashedSessionTokenWithTrackingId.sessionTrackingId,
      );

      if (result.code !== 200) {
        const responseErrors =
          result.result?.map((res) => res.statusCode) ?? [];

        if (responseErrors.includes(409)) {
          return err(
            new ConflictError(
              `Conflict error creating user session. Status code: ${result.code}. Errors: ${JSON.stringify(responseErrors)}`,
            ),
          );
        }

        return err(
          new GenericError(
            `Error creating user session. Status code: ${result.code}. Errors: ${JSON.stringify(responseErrors)}`,
          ),
        );
      }

      return ok(userSessionToCreate);
    } catch (error) {
      return this.handleCosmosError(
        error,
        "UserSession" as NonEmptyString,
        "createUserSession" as NonEmptyString,
      );
    }
  }

  private async createSessionMetadata(
    sessionMetadata: SessionMetadata,
  ): Promise<Result<void, ConflictError | GenericError>> {
    const sessionMetadataTtl = this.computeTtl(sessionMetadata.expirationDate);

    if (sessionMetadataTtl.isErr()) {
      return err(sessionMetadataTtl.error);
    }

    const sessionInfoDoc = {
      id: COSMOS_SESSION_METADATA_ID,
      type: COSMOS_SESSION_METADATA_ID,
      fiscalCode: sessionMetadata.fiscalCode,
      loginType: sessionMetadata.loginType,
      sessionTrackingId: sessionMetadata.sessionTrackingId,
      expirationDate: sessionMetadata.expirationDate.toISOString(),
      ttl: sessionMetadataTtl.value,
    };

    return this.createItem(
      this.sessionMetadataContainer,
      sessionInfoDoc,
      "SessionMetadata" as NonEmptyString,
    ).then((result) => result.map(() => void 0));
  }

  private async deleteUserSession(
    userSessionWithTokens: SessionWithHashedSSOTokens,
  ): Promise<Result<void, GenericError | NotFoundError>> {
    const tokenIds = [
      toCosmosSessionId(
        userSessionWithTokens.hashedSessionTokenWithTrackingId
          .hashedSessionToken,
      ),
      toCosmosWalletSessionId(
        userSessionWithTokens.ssoTokens.walletHashedToken,
      ),
      toCosmosBpdSessionId(userSessionWithTokens.ssoTokens.bpdHashedToken),
      toCosmosFimsSessionId(userSessionWithTokens.ssoTokens.fimsHashedToken),
      toCosmosZendeskSessionId(
        userSessionWithTokens.ssoTokens.zendeskHashedToken,
      ),
    ];

    const operations: OperationInput[] = tokenIds.map((id) => ({
      operationType: BulkOperationType.Delete,
      id,
      partitionKey:
        userSessionWithTokens.hashedSessionTokenWithTrackingId
          .sessionTrackingId,
    }));

    try {
      const result =
        await this.userSessionContainer.items.executeBulkOperations(operations);

      for (const res of result) {
        if (
          // Avoid returning an error for successes or not found items
          res.response?.statusCode !== 200 &&
          res.response?.statusCode !== 204 &&
          res.response?.statusCode !== 404 &&
          res.response !== undefined
        ) {
          return err(
            new GenericError(
              `Error deleting user session. Status code: ${res.response?.statusCode}`,
            ),
          );
        }
      }
      return ok(undefined);
    } catch (error) {
      return this.handleCosmosError(
        error,
        "UserSession" as NonEmptyString,
        "deleteUserSession" as NonEmptyString,
      ).mapErr((e) =>
        e instanceof ConflictError ? new GenericError(e.message) : e,
      );
    }
  }

  private async deleteSessionMetadata(
    fiscalCode: FiscalCode,
  ): Promise<Result<void, GenericError>> {
    try {
      await this.sessionMetadataContainer
        .item(COSMOS_SESSION_METADATA_ID, fiscalCode)
        .delete();
      return ok(undefined);
    } catch (error: any) {
      if (error?.code === 404) {
        return ok(undefined);
      }
      return err(new GenericError("Error deleting session info data"));
    }
  }
}

// ---------------------------------------------------------------------------
// Private Mappers Functions
// ---------------------------------------------------------------------------

function fromDbSessionMetadata(
  raw: JSONObject,
): Result<SessionMetadata, GenericError> {
  const parsed = SessionMetadataSchema.safeParse({
    ...raw,
    expirationDate: new Date(raw.expirationDate as string),
  });
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(new GenericError(`Error parsing session metadata from DB`));
}

function fromDbSession(raw: JSONObject): Result<Session, GenericError> {
  const parsedSession = SessionSchema.safeParse({
    hashedSessionTokenWithTrackingId: {
      sessionTrackingId: raw.sessionTrackingId,
      hashedSessionToken: String(raw.id).replace(COSMOS_SESSION_PREFIX, ""),
    },
    fiscalCode: raw.fiscalCode,
    name: raw.name,
    familyName: raw.familyName,
    dateOfBirth: new Date(raw.dateOfBirth as string),
    spidLevel: raw.spidLevel,
    expirationDate: new Date(raw.expirationDate as string),
    createdAt: new Date(raw.createdAt as string),
    spidEmail: raw.spidEmail ?? undefined,
  });

  if (parsedSession.success) {
    return ok(parsedSession.data);
  } else {
    return err(new GenericError(`Error parsing session from DB`));
  }
}

function toDbSession(session: Session, ttl: number): JSONObject {
  return {
    id: toCosmosSessionId(
      session.hashedSessionTokenWithTrackingId.hashedSessionToken,
    ),
    sessionTrackingId:
      session.hashedSessionTokenWithTrackingId.sessionTrackingId,
    fiscalCode: session.fiscalCode,
    name: session.name,
    familyName: session.familyName,
    dateOfBirth: session.dateOfBirth.toISOString(),
    spidLevel: session.spidLevel,
    expirationDate: session.expirationDate.toISOString(),
    spidEmail: session.spidEmail ?? null,
    ttl,
    createdAt: new Date().toISOString(),
  };
}

function toDbWalletUserSession(
  session: SessionWithHashedSSOTokens,
  ttl: number,
): JSONObject {
  return {
    ...toDbSession(session, ttl),
    id: toCosmosWalletSessionId(session.ssoTokens.walletHashedToken),
  };
}

function toDbBpdUserSession(
  session: SessionWithHashedSSOTokens,
  ttl: number,
): JSONObject {
  return {
    ...toDbSession(session, ttl),
    id: toCosmosBpdSessionId(session.ssoTokens.bpdHashedToken),
  };
}

function toDbFimsUserSession(
  session: SessionWithHashedSSOTokens,
  ttl: number,
): JSONObject {
  return {
    ...toDbSession(session, ttl),
    id: toCosmosFimsSessionId(session.ssoTokens.fimsHashedToken),
  };
}

function toDbZendeskUserSession(
  session: SessionWithHashedSSOTokens,
  ttl: number,
): JSONObject {
  return {
    ...toDbSession(session, ttl),
    id: toCosmosZendeskSessionId(session.ssoTokens.zendeskHashedToken),
  };
}

function toCosmosSessionId(
  hashedSessionToken: HashedSessionToken,
): NonEmptyString {
  return (COSMOS_SESSION_PREFIX + hashedSessionToken) as NonEmptyString;
}

function toCosmosWalletSessionId(
  walletHashedToken: HashedWalletSSOToken,
): NonEmptyString {
  return (COSMOS_WALLET_PREFIX + walletHashedToken) as NonEmptyString;
}

function toCosmosBpdSessionId(
  bpdHashedToken: HashedBpdSSOToken,
): NonEmptyString {
  return (COSMOS_BPD_PREFIX + bpdHashedToken) as NonEmptyString;
}

function toCosmosFimsSessionId(
  fimsHashedToken: HashedFimsSSOToken,
): NonEmptyString {
  return (COSMOS_FIMS_PREFIX + fimsHashedToken) as NonEmptyString;
}

function toCosmosZendeskSessionId(
  zendeskHashedToken: HashedZendeskSSOToken,
): NonEmptyString {
  return (COSMOS_ZENDESK_PREFIX + zendeskHashedToken) as NonEmptyString;
}
