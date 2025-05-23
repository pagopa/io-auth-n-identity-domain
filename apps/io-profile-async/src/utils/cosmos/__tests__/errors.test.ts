import { describe, it, expect, vi } from "vitest";
import * as t from "io-ts";
import {
  CosmosErrors,
  CosmosResource
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  getSelfFromModelValidationError,
  cosmosErrorsToString
} from "../errors";

describe("cosmosErrorsToString", () => {
  it("should return 'Empty response' for COSMOS_EMPTY_RESPONSE", () => {
    const error = { kind: "COSMOS_EMPTY_RESPONSE" } as CosmosErrors;
    expect(cosmosErrorsToString(error)).toBe("Empty response");
  });

  it("should return decoding error message for COSMOS_DECODING_ERROR", () => {
    const error = {
      kind: "COSMOS_DECODING_ERROR",
      error: [
        {
          context: [],
          message: "Invalid type",
          value: "foo"
        }
      ]
    } as CosmosErrors;
    expect(cosmosErrorsToString(error)).toContain("Decoding error:");
  });

  it("should return 'Conflict error' for COSMOS_CONFLICT_RESPONSE", () => {
    const error = { kind: "COSMOS_CONFLICT_RESPONSE" } as CosmosErrors;
    expect(cosmosErrorsToString(error)).toBe("Conflict error");
  });

  it("should return generic error for other kinds", () => {
    const error = {
      kind: "COSMOS_ERROR_RESPONSE",
      error: { name: "ERROR", message: "A generic error occurred." }
    } as CosmosErrors;
    expect(cosmosErrorsToString(error)).toContain("Generic error:");
  });
});

describe("getSelfFromModelValidationError", () => {
  const spyOnCosmosResourceIs = vi.spyOn(CosmosResource, "is");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const type = {} as any;

  it("should return _self if actual is a CosmosResource", () => {
    const resource = {
      _self: "resource-self",
      _etag: "etag",
      _rid: "rid",
      _ts: 1234567890,
      id: "INVALID_ID"
    } as CosmosResource;

    const validationErrors: t.Errors = [
      {
        value: resource,
        context: [
          { key: "", type, actual: resource },
          { key: "0", type, actual: resource },
          { key: "id", type, actual: "INVALID_ID" }
        ],
        message: "Invalid value supplied to id"
      } as t.ValidationError
    ];

    spyOnCosmosResourceIs.mockReturnValueOnce(true);
    expect(getSelfFromModelValidationError(validationErrors)).toBe(
      "resource-self"
    );
  });

  it("should return 'N/A' if actual is not a CosmosResource", () => {
    const validationErrors: t.Errors = [
      {
        value: {},
        context: [{ key: "", type, actual: {} }],
        message: undefined
      }
    ];

    spyOnCosmosResourceIs.mockReturnValueOnce(false);
    expect(getSelfFromModelValidationError(validationErrors)).toBe("N/A");
  });

  it("should return 'N/A' if validationErrors is empty", () => {
    expect(getSelfFromModelValidationError([])).toBe("N/A");
  });
});
