import { Container, CosmosClient, JSONObject } from "@azure/cosmos";
import {
  ConflictError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";

import {
  LollipopActivation,
  LollipopActivationSchema,
} from "../../domain/entities/lollipop-activation.entity.js";
import { LollipopActivationPort } from "../../domain/ports/outbound/lollipop-activation.port.js";

import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { CosmosBaseAdapter } from "./cosmos-base.adapter.js";

export class LollipopActivationCosmosAdapter
  extends CosmosBaseAdapter
  implements LollipopActivationPort, HealthCheckOutboundPort
{
  protected readonly lollipopContainer: Container;

  constructor(
    client: CosmosClient,
    databaseId: string,
    lollipopContainerId: string,
  ) {
    super(client);

    this.lollipopContainer = this.client
      .database(databaseId)
      .container(lollipopContainerId);
  }

  async healthcheck(): Promise<Result<void, GenericError>> {
    try {
      await this.lollipopContainer.items
        .query("SELECT VALUE 1", { maxItemCount: 1 })
        .fetchNext();
      return ok(void 0);
    } catch (error) {
      return err(new GenericError(errorToString(error)));
    }
  }

  public async getByFiscalCode(
    fiscalCode: FiscalCode,
  ): Promise<Result<LollipopActivation, GenericError | NotFoundError>> {
    return (
      await this.readItem(
        this.lollipopContainer,
        toLollipopId(fiscalCode),
        fiscalCode as unknown as NonEmptyString,
        "LollipopActivation" as NonEmptyString,
      )
    ).andThen(fromDbLollipopActivation);
  }

  public async activate(
    activation: LollipopActivation,
  ): Promise<Result<void, ConflictError | GenericError>> {
    const ttl = this.computeTtl(activation.expirationDate);

    if (ttl.isErr()) {
      return err(ttl.error);
    }

    return this.createItem(
      this.lollipopContainer,
      toDbLollipopActivation(activation, ttl.value),
      "LollipopActivation" as NonEmptyString,
    ).then((result) => result.map(() => void 0));
  }

  public async revokeByFiscalCode(
    fiscalCode: FiscalCode,
  ): Promise<Result<void, GenericError>> {
    const activationResult = await this.getByFiscalCode(fiscalCode);
    if (activationResult.isErr()) {
      if (activationResult.error instanceof NotFoundError) {
        return ok(void 0);
      } else {
        return err(activationResult.error);
      }
    }

    try {
      await this.lollipopContainer
        .item(toLollipopId(fiscalCode), fiscalCode as unknown as NonEmptyString)
        .delete();

      return ok(void 0);
    } catch (error) {
      return err(
        new GenericError(
          `Error revoking lollipop activation: ${errorToString(error)}`,
        ),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Private Mappers Functions
// ---------------------------------------------------------------------------

function toLollipopId(fiscalCode: FiscalCode): NonEmptyString {
  return `LOLLIPOP-${fiscalCode}` as NonEmptyString;
}

function toDbLollipopActivation(
  activation: LollipopActivation,
  ttl: number,
): JSONObject {
  return {
    id: toLollipopId(activation.fiscalCode),
    fiscalCode: activation.fiscalCode,
    assertionRef: activation.assertionRef,
    expirationDate: activation.expirationDate.toISOString(),
    ttl,
  };
}

function fromDbLollipopActivation(
  dbResource: any,
): Result<LollipopActivation, GenericError> {
  const lollipopActivation = LollipopActivationSchema.safeParse({
    fiscalCode: dbResource.fiscalCode,
    assertionRef: dbResource.assertionRef,
    expirationDate: new Date(dbResource.expirationDate),
  });

  if (lollipopActivation.success) {
    return ok(lollipopActivation.data);
  } else {
    return err(new GenericError("Invalid lollipop activation"));
  }
}

// TODO: centralize (unknown) error to string conversion across the project
function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error);
}
