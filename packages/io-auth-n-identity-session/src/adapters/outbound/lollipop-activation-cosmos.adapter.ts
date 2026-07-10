import { Container, CosmosClient, JSONObject } from "@azure/cosmos";
import { err, ok, Result } from "neverthrow";
import {
  ConflictError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";

import {
  LollipopActivation,
  LollipopActivationSchema,
} from "../../domain/entities/lollipop-activation.entity.js";
import { ILollipopActivationPort } from "../../domain/ports/outbound/lollipop-activation.port.js";
import { CosmosBaseAdapter } from "./cosmos-base.adapter.js";

export class LollipopActivationCosmosAdapter
  extends CosmosBaseAdapter
  implements ILollipopActivationPort
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
  ): Promise<Result<void, GenericError | NotFoundError>> {
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
          `Error revoking lollipop activation: ${(error as Error).message}`,
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
