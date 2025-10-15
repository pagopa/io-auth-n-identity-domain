/* eslint-disable @typescript-eslint/no-explicit-any */

import { it, afterEach, beforeEach, describe, expect, vi } from "vitest";
import * as lolex from "lolex";

import { ulidGenerator } from "@pagopa/io-functions-commons/dist/src/utils/strings";

import { context as contextMock } from "../__mocks__/durable-functions";
import {
  aEmail,
  aFiscalCode,
  aValidator,
  aValidatorHash,
} from "../__mocks__/mocks";
import {
  ActivityInput as CreateValidationTokenActivityInput,
  getCreateValidationTokenActivityHandler,
} from "../create-validation-token-activity";
import { envConfig } from "../__mocks__/env-config.mock";

const VALIDATION_TOKEN_TABLE_NAME = envConfig.VALIDATION_TOKENS_TABLE_NAME;

// eslint-disable-next-line functional/no-let
let clock: any;
beforeEach(() => {
  // We need to mock time to test token expiration.
  clock = lolex.install({ now: Date.now() });
});
afterEach(() => {
  clock = clock.uninstall();
});

describe("CreateValidationTokenActivityHandler", () => {
  it("should create a ValidationToken entity", async () => {
    const id = ulidGenerator();
    const ulidGeneratorMock = vi.fn(() => id);
    const tableServiceMock = {
      insertEntity: vi.fn((_, __, f) => {
        f(undefined, {});
      }),
    };

    const handler = getCreateValidationTokenActivityHandler(
      ulidGeneratorMock,
      tableServiceMock as any,
      VALIDATION_TOKEN_TABLE_NAME,
      5000 as any,
      // validator
      () => aValidator,
      // validatorHash
      () => aValidatorHash,
    );

    const input = CreateValidationTokenActivityInput.encode({
      email: aEmail,
      fiscalCode: aFiscalCode,
    });

    await handler(contextMock as any, input);

    expect(tableServiceMock.insertEntity).toHaveBeenCalledWith(
      VALIDATION_TOKEN_TABLE_NAME,
      {
        Email: aEmail,
        FiscalCode: aFiscalCode,
        InvalidAfter: new Date(Date.now() + 5000),
        PartitionKey: id,
        RowKey: aValidatorHash,
      },
      expect.any(Function),
    );
  });
});
