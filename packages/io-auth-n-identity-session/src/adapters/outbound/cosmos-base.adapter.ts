import {
  Container,
  CosmosClient,
  ErrorResponse,
  JSONObject,
  Resource,
} from "@azure/cosmos";
import {
  ConflictError,
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";

export abstract class CosmosBaseAdapter {
  protected readonly client: CosmosClient;

  constructor(client: CosmosClient) {
    this.client = client;
  }

  dispose(): void {
    this.client.dispose();
  }

  protected async createItem(
    container: Container,
    document: JSONObject,
    entityName: NonEmptyString,
  ): Promise<Result<JSONObject & Resource, ConflictError | GenericError>> {
    try {
      const { resource: createdItem } = await container.items.create(document);

      if (!createdItem) {
        return err(
          new GenericError(
            `Error creating ${entityName}: no resource returned`,
          ),
        );
      }
      return ok(createdItem);
    } catch (error) {
      return this.handleCosmosError(
        error,
        entityName,
        "createItem" as NonEmptyString,
      );
    }
  }

  protected async readItem(
    container: Container,
    id: NonEmptyString,
    partitionKey: NonEmptyString,
    entityName: NonEmptyString,
  ): Promise<Result<JSONObject & Resource, GenericError | NotFoundError>> {
    try {
      const { resource: item, statusCode } = await container
        .item(id, partitionKey)
        .read<JSONObject>();

      if (statusCode === 404 || !item) {
        return err(
          new NotFoundError(entityName, `${entityName} not found (id: ${id})`),
        );
      }
      if (statusCode !== 200) {
        return err(
          new GenericError(
            `Error reading item (id: ${id}): status code ${statusCode}`,
          ),
        );
      }
      return ok(item);
    } catch (error) {
      return this.handleCosmosError(
        error,
        entityName,
        "readItem" as NonEmptyString,
      ).mapErr((e) =>
        e instanceof ConflictError ? new GenericError(e.message) : e,
      );
    }
  }

  protected computeTtl(expirationDate: Date): Result<number, GenericError> {
    const diff = expirationDate.getTime() - Date.now();
    if (diff <= 0) {
      return err(
        new GenericError(
          `Expiration date must be in the future: ${expirationDate.toISOString()}`,
        ),
      );
    }

    return ok(Math.floor((expirationDate.getTime() - Date.now()) / 1000));
  }

  protected handleCosmosError(
    error: unknown,
    entityName: NonEmptyString,
    functionName: NonEmptyString,
  ): Result<never, ConflictError | GenericError> {
    if (error instanceof ErrorResponse) {
      if (error.code === 409) {
        return err(
          new ConflictError(
            `Conflict error handling ${entityName} in ${functionName}`,
          ),
        );
      }
      return err(
        new GenericError(
          `Error handling ${entityName} in ${functionName}: code ${error.code}`,
        ),
      );
    }
    return err(
      new GenericError(`Error handling ${entityName} in ${functionName}`),
    );
  }
}
