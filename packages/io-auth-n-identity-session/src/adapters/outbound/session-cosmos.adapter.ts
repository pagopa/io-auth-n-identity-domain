import {
  BulkOperationType,
  Container,
  CosmosClient,
  JSONObject,
} from "@azure/cosmos";
import {
  ConflictError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";

import type { ActiveSession } from "../../domain/entities/active-session.entity.js";
import { ActiveSessionSchema } from "../../domain/entities/active-session.entity.js";
import { BaseSessionSchema } from "../../domain/entities/session.entity.js";
import type {
  SessionWithHashedToken,
  BaseSession,
  SessionWithHashedSSOTokens,
} from "../../domain/entities/session.entity.js";
import {
  HashedSessionTokenWithSessionId,
  SessionPort,
} from "../../domain/ports/outbound/session.port.js";
import { SessionId } from "../../domain/value-objects/session-id.vo.js";
import type { HashedBpdSSOToken } from "../../domain/value-objects/tokens/bpd-sso-token.vo.js";
import type { HashedFimsSSOToken } from "../../domain/value-objects/tokens/fims-sso-token.vo.js";
import {
  HashedSessionTokenSchema,
  type HashedSessionToken,
} from "../../domain/value-objects/tokens/session-token.vo.js";
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

// ---------------------------------------------------------------------------
// Cosmos DB Adapter for SessionPort
// ---------------------------------------------------------------------------

export class SessionCosmosAdapter
  extends CosmosBaseAdapter
  implements SessionPort
{
  protected readonly sessionTokenContainer: Container;
  protected readonly activeSessionContainer: Container;

  constructor(
    client: CosmosClient,
    databaseId: string,
    sessionTokenContainerId: string,
    activeSessionContainerId: string,
  ) {
    super(client);

    this.sessionTokenContainer = this.client
      .database(databaseId)
      .container(sessionTokenContainerId);
    this.activeSessionContainer = this.client
      .database(databaseId)
      .container(activeSessionContainerId);
  }

  public async findBySessionToken({
    hashedSessionToken,
    sessionId,
  }: HashedSessionTokenWithSessionId): Promise<
    Result<BaseSession, GenericError | NotFoundError>
  > {
    const result = await this.readItem(
      this.sessionTokenContainer,
      toCosmosSessionId(hashedSessionToken),
      sessionId as unknown as NonEmptyString,
      "UserSession" as NonEmptyString,
    );
    return result.andThen((rawSession) => fromDbSession(rawSession));
  }

  public async findByBpdToken(bpdToken: {
    hashedBPDSSOToken: HashedBpdSSOToken;
    sessionId: SessionId;
  }): Promise<Result<BaseSession, GenericError | NotFoundError>> {
    const result = await this.readItem(
      this.sessionTokenContainer,
      toCosmosBpdSessionId(bpdToken.hashedBPDSSOToken),
      bpdToken.sessionId as unknown as NonEmptyString,
      "BPDSSOSession" as NonEmptyString,
    );
    return result.andThen((rawSession) => fromDbSession(rawSession));
  }

  public async create(
    activeSession: ActiveSession,
    session: SessionWithHashedSSOTokens,
  ): Promise<Result<SessionWithHashedSSOTokens, ConflictError | GenericError>> {
    // First create the volatile user session in the userSessionContainer, which will expire after TTL.
    const sessionCreationResult = await this.createUserSession(session);
    if (sessionCreationResult.isErr()) {
      return sessionCreationResult;
    }

    // Then create the active session in the activeSessionContainer, which will also expire after its TTL,
    // which it can be different from the user session TTL, depending on the login type.
    const activeSessionCreationResult =
      await this.createActiveSession(activeSession);
    if (activeSessionCreationResult.isErr()) {
      // If an error occurs during the creation of the active session,
      // the userSession will be left orphaned in the userSessionContainer and will expire after TTL.
      return err(activeSessionCreationResult.error);
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
    // First delete the ActiveSession, since fiscalCode is needed
    //  to perform the deletion.
    const deleteActiveSessionResult = await this.deleteActiveSession(
      sessionTokens.fiscalCode,
    );
    if (deleteActiveSessionResult.isErr()) {
      return deleteActiveSessionResult;
    }

    // Then delete the user session in the session tokens container
    // If an error occurs during the deletion, the request can be retried
    const deleteSessionInfoResult = await this.deleteUserSession(sessionTokens);
    if (deleteSessionInfoResult.isErr()) {
      return deleteSessionInfoResult;
    }

    return ok(void 0);
  }

  public async invalidatePreviousSession(
    fiscalCode: FiscalCode,
  ): Promise<
    Result<HashedSessionTokenWithSessionId | undefined, GenericError>
  > {
    try {
      // Step 1: read the ActiveSession for the given fiscalCode to get the sessionId
      const activeSessionResult = await this.getActiveSession(fiscalCode);

      if (activeSessionResult.isErr()) {
        if (activeSessionResult.error instanceof NotFoundError) {
          // no previous session to invalidate
          return ok(undefined);
        }
        return err(activeSessionResult.error);
      }

      const sessionId = activeSessionResult.value.sessionId;

      // Step 2: delete all token items in userSessionContainer for that sessionId
      const { resources: items } = await this.sessionTokenContainer.items
        .query<{
          id: string;
        }>(
          {
            query: "SELECT c.id FROM c WHERE c.sessionId = @sessionId",
            parameters: [{ name: "@sessionId", value: sessionId }],
          },
          { partitionKey: sessionId },
        )
        .fetchAll();

      // Extract the hashed session token from the SESSION- item before deleting
      const sessionItem = items.find((item) =>
        item.id.startsWith(COSMOS_SESSION_PREFIX),
      );
      const hashedSessionToken = sessionItem
        ? String(sessionItem.id).replace(COSMOS_SESSION_PREFIX, "")
        : undefined;

      // All token items can be deleted together here: the retry anchor is the
      // fiscalCode/ActiveSession (deleted last in Step 3), not the SESSION- token.
      const deleteResult = await this.bulkDeleteItems(
        this.sessionTokenContainer,
        items.map((item: { id: string }) => item.id as NonEmptyString),
        sessionId as unknown as NonEmptyString,
        "UserSession" as NonEmptyString,
      );
      if (deleteResult.isErr()) {
        return err(deleteResult.error);
      }

      // Step 3: delete ActiveSession
      await this.activeSessionContainer.item(fiscalCode, fiscalCode).delete();

      if (hashedSessionToken) {
        const parsed = HashedSessionTokenSchema.safeParse(hashedSessionToken);

        if (parsed.success) {
          return ok({
            sessionId: sessionId,
            hashedSessionToken: parsed.data,
          });
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

  private async getActiveSession(
    fiscalCode: FiscalCode,
  ): Promise<Result<ActiveSession, GenericError | NotFoundError>> {
    const result = await this.readItem(
      this.activeSessionContainer,
      fiscalCode as unknown as NonEmptyString,
      fiscalCode as unknown as NonEmptyString,
      "ActiveSession" as NonEmptyString,
    );
    return result.andThen(fromDbActiveSession);
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
      const result = await this.sessionTokenContainer.items.batch(
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
        userSessionToCreate.sessionId,
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

  private async createActiveSession(
    activeSession: ActiveSession,
  ): Promise<Result<void, ConflictError | GenericError>> {
    const activeSessionTtl = this.computeTtl(activeSession.expirationDate);

    if (activeSessionTtl.isErr()) {
      return err(activeSessionTtl.error);
    }

    const sessionInfoDoc = {
      id: activeSession.fiscalCode,
      fiscalCode: activeSession.fiscalCode,
      loginType: activeSession.loginType,
      sessionId: activeSession.sessionId,
      expirationDate: activeSession.expirationDate.toISOString(),
      ttl: activeSessionTtl.value,
    };

    return this.createItem(
      this.activeSessionContainer,
      sessionInfoDoc,
      "ActiveSession" as NonEmptyString,
    ).then((result) => result.map(() => void 0));
  }

  private async deleteUserSession(
    userSessionWithTokens: SessionWithHashedSSOTokens,
  ): Promise<Result<void, GenericError | NotFoundError>> {
    // First delete the SSO token items. The main SESSION- token is deleted last
    // so that, if an SSO deletion fails, it survives as the "anchor" that allows
    // the session (fiscalCode and derived SSO tokens) to be re-resolved for a retry.
    const ssoTokenIds = [
      toCosmosWalletSessionId(
        userSessionWithTokens.ssoTokens.walletHashedToken,
      ),
      toCosmosBpdSessionId(userSessionWithTokens.ssoTokens.bpdHashedToken),
      toCosmosFimsSessionId(userSessionWithTokens.ssoTokens.fimsHashedToken),
      toCosmosZendeskSessionId(
        userSessionWithTokens.ssoTokens.zendeskHashedToken,
      ),
    ];

    const deleteSsoTokensResult = await this.bulkDeleteItems(
      this.sessionTokenContainer,
      ssoTokenIds,
      userSessionWithTokens.sessionId as unknown as NonEmptyString,
      "UserSession" as NonEmptyString,
    );
    if (deleteSsoTokensResult.isErr()) {
      return deleteSsoTokensResult;
    }

    // Then delete the main SESSION- token last.
    return this.bulkDeleteItems(
      this.sessionTokenContainer,
      [toCosmosSessionId(userSessionWithTokens.hashedSessionToken)],
      userSessionWithTokens.sessionId as unknown as NonEmptyString,
      "UserSession" as NonEmptyString,
    );
  }

  private async deleteActiveSession(
    fiscalCode: FiscalCode,
  ): Promise<Result<void, GenericError>> {
    try {
      await this.activeSessionContainer.item(fiscalCode, fiscalCode).delete();
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

function fromDbActiveSession(
  raw: JSONObject,
): Result<ActiveSession, GenericError> {
  const parsed = ActiveSessionSchema.safeParse({
    ...raw,
    expirationDate: new Date(raw.expirationDate as string),
  });
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(new GenericError(`Error parsing active session from DB`));
}

function fromDbSession(raw: JSONObject): Result<BaseSession, GenericError> {
  const parsedSession = BaseSessionSchema.safeParse({
    sessionId: raw.sessionId,
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

function toDbSession(session: SessionWithHashedToken, ttl: number): JSONObject {
  return {
    id: toCosmosSessionId(session.hashedSessionToken),
    sessionId: session.sessionId,
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
