import { describe, expect, it, vi } from "vitest";
import { Database } from "@azure/cosmos";
import * as E from "fp-ts/lib/Either";
import * as H from "@pagopa/handler-kit";
import * as TE from "fp-ts/lib/TaskEither";
import { makeInfoHandler } from "../info";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import { getConfigOrThrow } from "../../config";

import * as azureStorageHealthCheck from "../../utils/azurestorage/healthcheck";

const config = getConfigOrThrow();
const connectionString = config.AZURE_STORAGE_CONNECTION_STRING;

const mockDatabaseAccount = vi.fn().mockResolvedValue("");
const cosmosDatabaseMock = ({
  client: {
    getDatabaseAccount: mockDatabaseAccount
  }
} as unknown) as Database;

const azureStorageHealthCheckMock = vi.spyOn(
  azureStorageHealthCheck,
  "makeAzureStorageHealthCheck"
);

describe("Info handler", () => {
  it("should return an error if the Cosmos health check fail", async () => {
    azureStorageHealthCheckMock.mockImplementationOnce(() => TE.right(true));

    mockDatabaseAccount.mockRejectedValueOnce("db error");

    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      db: cosmosDatabaseMock,
      connectionString
    })();

    expect(result).toMatchObject(
      E.right(
        H.problemJson({
          status: 500,
          title: "AzureCosmosDB|db error"
        })
      )
    );
  });

  it("should succeed if the application is healthy", async () => {
    azureStorageHealthCheckMock.mockImplementationOnce(() => TE.right(true));

    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      db: cosmosDatabaseMock,
      connectionString
    })();

    expect(result).toMatchObject(
      E.right(
        H.successJson({
          name: "io-profile-async",
          version: expect.any(String)
        })
      )
    );
  });
});
