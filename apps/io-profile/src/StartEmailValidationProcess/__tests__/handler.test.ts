/* eslint-disable @typescript-eslint/no-explicit-any */
import * as durableFunction from "durable-functions";
import { some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  context as contextMock,
  mockStartNew,
} from "../../__mocks__/durable-functions";
import { aRetrievedProfile } from "../../__mocks__/mocks";
import { EmailValidationProcessParams } from "../../generated/definitions/internal/EmailValidationProcessParams";
import { StartEmailValidationProcessHandler } from "../handler";
import * as orchUtil from "../orchestrators";

const getClientMock = {
  startNew: mockStartNew,
} as any;

const isOrchestratorRunnißngMock = vi.fn(() =>
  taskEither.of({
    isRunning: false,
  }),
);

const aValidPayload: EmailValidationProcessParams = { name: "EXAMPLE_NAME" };

vi.spyOn(durableFunction, "getClient").mockImplementation((_) => getClientMock);
vi.spyOn(orchUtil, "isOrchestratorRunning").mockImplementation(
  isOrchestratorRunningMock as any,
);
describe("StartEmailValidationProcessHandler", () => {
  beforeEach(() => mockStartNew.mockClear());
  it("should start the orchestrator with the right input and return an accepted response", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        taskEither.of(
          some({
            ...aRetrievedProfile,
            isEmailValidated: false,
          }),
        ),
      ),
    };
    mockStartNew.mockImplementationOnce(() => Promise.resolve("start"));

    const handler = StartEmailValidationProcessHandler(profileModelMock as any);

    const result = await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode,
      aValidPayload,
    );

    expect(result.kind).toBe("IResponseSuccessAccepted");
  });

  it("should not start a new orchestrator if there is an already running orchestrator and return an accepted response", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        taskEither.of(
          some({
            ...aRetrievedProfile,
            isEmailValidated: false,
          }),
        ),
      ),
    };

    isOrchestratorRunningMock.mockImplementationOnce(() =>
      taskEither.of({
        isRunning: true,
      }),
    );
    const handler = StartEmailValidationProcessHandler(profileModelMock as any);

    const result = await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode,
      aValidPayload,
    );
    expect(mockStartNew).not.toHaveBeenCalled();

    expect(result.kind).toBe("IResponseSuccessAccepted");
  });

  it("should not start the orchestrator if the email is already validated", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        taskEither.of(some({ ...aRetrievedProfile, isEmailValidated: true })),
      ),
    };

    const handler = StartEmailValidationProcessHandler(profileModelMock as any);

    await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode,
      aValidPayload,
    );
    const result = await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode,
      aValidPayload,
    );
    expect(result.kind).toBe("IResponseErrorValidation");
  });
});
