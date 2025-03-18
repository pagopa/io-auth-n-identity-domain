/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach } from "node:test";
import { assert, describe, expect, it, vi } from "vitest";
import { context as contextMock } from "../__mocks__/durable-functions";
import {
  aEmail,
  aFiscalCode,
  aName,
  aTokenId,
  aValidator,
  aValidatorHash,
} from "../__mocks__/mocks";
import {
  ActivityInput as CreateValidationTokenActivityInput,
  ActivityResult as CreateValidationTokenActivityResult,
} from "../create-validation-token-activity";
import {
  ActivityInput as SendValidationEmailActivityInput,
  ActivityResult as SendValidationEmailActivityResult,
} from "../send-templated-validation-email-activity";
import {
  OrchestratorInput as EmailValidationProcessOrchestratorInput,
  EmailValidationOrchestratorHandler,
} from "../email-validation-orchestrator";

describe("EmailValidationWithTemaplteProcessOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should start the activities with the right inputs", async () => {
    const emailValidationProcessOrchestratorInput =
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmail,
        fiscalCode: aFiscalCode,
        name: aName,
      });

    const createValidationTokenActivityResult =
      CreateValidationTokenActivityResult.encode({
        kind: "SUCCESS",
        value: {
          validationTokenEntity: {
            Email: aEmail,
            FiscalCode: aFiscalCode,
            InvalidAfter: new Date(),
            PartitionKey: aTokenId,
            RowKey: aValidatorHash,
          },
          validator: aValidator,
        },
      });

    const sendValidationEmailActivityResult =
      SendValidationEmailActivityResult.encode({
        kind: "SUCCESS",
      });

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(createValidationTokenActivityResult)
          .mockReturnValueOnce(sendValidationEmailActivityResult),
        getInput: vi.fn(() => emailValidationProcessOrchestratorInput),
      },
    };

    const orchestratorHandler = EmailValidationOrchestratorHandler(
      contextMockWithDf as any,
    );

    const result = orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "CreateValidationTokenActivity",
      expect.anything(), // retryOptions
      CreateValidationTokenActivityInput.encode({
        email: aEmail,
        fiscalCode: aFiscalCode,
      }),
    );

    orchestratorHandler.next(result.value);

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendTemplatedValidationEmailActivity",
      expect.anything(), // retryOptions
      SendValidationEmailActivityInput.encode({
        email: aEmail,
        token: `${aTokenId}:${aValidator}`,
        name: aName,
      }),
    );
  });

  it("should return a failure when a decoding error for input occurs", async () => {
    const emailValidationProcessOrchestratorInput = { foo: "bar" };

    const contextMockWithDf = {
      ...contextMock,
      df: {
        getInput: vi.fn(() => emailValidationProcessOrchestratorInput),
      },
    };

    const orchestratorHandler = EmailValidationOrchestratorHandler(
      contextMockWithDf as any,
    );

    const result = orchestratorHandler.next();

    expect(result).toEqual({
      value: {
        kind: "FAILURE",
        reason: expect.stringContaining("is not a valid"),
      },
      done: true,
    });
  });

  it.each`
    value
    ${{ malformed: true }}
    ${CreateValidationTokenActivityResult.encode({ kind: "FAILURE", reason: "error" })}
  `(
    "should fail when an error for CreateValidationTokenActivity occurs",
    async ({ value }) => {
      const emailValidationProcessOrchestratorInput =
        EmailValidationProcessOrchestratorInput.encode({
          email: aEmail,
          fiscalCode: aFiscalCode,
          name: aName,
        });
      const createValidationTokenActivityResult = value;
      const contextMockWithDf = {
        ...contextMock,
        df: {
          callActivityWithRetry: vi
            .fn()
            .mockReturnValueOnce(createValidationTokenActivityResult),
          getInput: vi.fn(() => emailValidationProcessOrchestratorInput),
        },
      };

      const orchestratorHandler = EmailValidationOrchestratorHandler(
        contextMockWithDf as any,
      );

      orchestratorHandler.next();
      expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
        "CreateValidationTokenActivity",
        expect.anything(), // retryOptions
        CreateValidationTokenActivityInput.encode({
          email: aEmail,
          fiscalCode: aFiscalCode,
        }),
      );
      try {
        orchestratorHandler.next();
        assert.fail();
      } catch (e) {
        expect(e).toMatchObject({
          message: expect.stringContaining(
            `EmailValidationWithTemplateProcessOrchestrator|Max retry exceeded`,
          ),
        });
      }
    },
  );

  it.each`
    value
    ${{ malformed: true }}
    ${SendValidationEmailActivityResult.encode({ kind: "FAILURE", reason: "error" })}
  `(
    "should fail when an error for SendValidationEmailActivity occurs",
    async ({ value }) => {
      const emailValidationProcessOrchestratorInput =
        EmailValidationProcessOrchestratorInput.encode({
          email: aEmail,
          fiscalCode: aFiscalCode,
          name: aName,
        });
      const createValidationTokenActivityResult =
        CreateValidationTokenActivityResult.encode({
          kind: "SUCCESS",
          value: {
            validationTokenEntity: {
              Email: aEmail,
              FiscalCode: aFiscalCode,
              InvalidAfter: new Date(),
              PartitionKey: aTokenId,
              RowKey: aValidatorHash,
            },
            validator: aValidator,
          },
        });
      const sendValidationEmailActivityResult = value;

      const contextMockWithDf = {
        ...contextMock,
        df: {
          callActivityWithRetry: vi
            .fn()
            .mockReturnValueOnce(createValidationTokenActivityResult)
            .mockReturnValueOnce(sendValidationEmailActivityResult),
          getInput: vi.fn(() => emailValidationProcessOrchestratorInput),
        },
      };

      const orchestratorHandler = EmailValidationOrchestratorHandler(
        contextMockWithDf as any,
      );

      const result = orchestratorHandler.next();

      try {
        orchestratorHandler.next(result.value);
        orchestratorHandler.next();
        assert.fail();
      } catch (e) {
        expect(e).toMatchObject({
          message: expect.stringContaining(
            `EmailValidationWithTemplateProcessOrchestrator|Max retry exceeded`,
          ),
        });
      }

      expect(
        contextMockWithDf.df.callActivityWithRetry,
      ).toHaveBeenNthCalledWith(
        1,
        "CreateValidationTokenActivity",
        expect.anything(), // retryOptions
        CreateValidationTokenActivityInput.encode({
          email: aEmail,
          fiscalCode: aFiscalCode,
        }),
      );
      expect(
        contextMockWithDf.df.callActivityWithRetry,
      ).toHaveBeenNthCalledWith(
        2,
        "SendTemplatedValidationEmailActivity",
        expect.anything(), // retryOptions
        SendValidationEmailActivityInput.encode({
          email: aEmail,
          token: `${aTokenId}:${aValidator}`,
          name: aName,
        }),
      );
    },
  );
});
