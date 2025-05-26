import { Database } from "@azure/cosmos";
import * as H from "@pagopa/handler-kit";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { describe, expect, it, vi } from "vitest";
import * as azureStorageHealthCheck from "../../utils/azurestorage/healthcheck";
import * as packageUtils from "../../utils/package";
import { connectionString } from "../__mocks__/azurestorage.mock";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import { makeInfoHandler } from "../info";

const mockCitizenAuthDatabaseAccount = vi.fn().mockResolvedValue("");
const citizenAccountDatabaseMock = ({
  client: {
    getDatabaseAccount: mockCitizenAuthDatabaseAccount
  }
} as unknown) as Database;

const mockCosmosApiDatabaseAccount = vi.fn().mockResolvedValue("");
const cosmosApiDatabaseMock = ({
  client: {
    getDatabaseAccount: mockCosmosApiDatabaseAccount
  }
} as unknown) as Database;

const azureStorageHealthCheckMock = vi.spyOn(
  azureStorageHealthCheck,
  "makeAzureStorageHealthCheck"
);

const getCurrentBackendVersionMock = vi.spyOn(
  packageUtils,
  "getCurrentBackendVersion"
);

describe("Info handler", () => {
  it("should return an error if the Cosmos health check fail", async () => {
    azureStorageHealthCheckMock.mockImplementationOnce(() =>
      TE.right(true as const)
    );

    mockCosmosApiDatabaseAccount.mockRejectedValueOnce("cosmos api db error");
    mockCitizenAuthDatabaseAccount.mockRejectedValueOnce(
      "citizen account db error"
    );

    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      cosmosApiDb: cosmosApiDatabaseMock,
      citizenAuthDb: citizenAccountDatabaseMock,
      connectionString
    })();

    expect(result).toMatchObject(
      E.right(
        H.problemJson({
          status: 500,
          title:
            "CosmosApiAzureCosmosDB|cosmos api db error\n\nCitizenAuthAzureCosmosDB|citizen account db error"
        })
      )
    );
  });

  it("should succeed if the application is healthy", async () => {
    azureStorageHealthCheckMock.mockImplementationOnce(() =>
      TE.right(true as const)
    );
    getCurrentBackendVersionMock.mockReturnValueOnce("1.0.0");

    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      cosmosApiDb: cosmosApiDatabaseMock,
      citizenAuthDb: citizenAccountDatabaseMock,
      connectionString
    })();

    expect(result).toMatchObject(
      E.right(
        H.successJson({
          name: "io-profile-async",
          version: "1.0.0"
        })
      )
    );
  });
});
