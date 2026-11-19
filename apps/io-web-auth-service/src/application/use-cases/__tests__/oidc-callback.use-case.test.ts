import { GenericError, NonEmptyString } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPort } from "../../../domain/ports/outbound/session.port.js";
import { makeHandleOidcCallbackUseCase } from "../oidc-callback.use-case.js";

const STATE = "a-state" as NonEmptyString;
const CODE = "a-code" as NonEmptyString;
const TOKEN = "a-session-token" as NonEmptyString;

const sessionPort = {
  create: vi.fn<SessionPort["create"]>(),
  check: vi.fn<SessionPort["check"]>(),
} satisfies SessionPort;

const useCase = makeHandleOidcCallbackUseCase({ sessionPort });

describe("makeHandleOidcCallbackUseCase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("success callback", () => {
    it("creates a session and returns the token", async () => {
      sessionPort.create.mockResolvedValueOnce(ok(TOKEN));

      const result = await useCase({ callback: { state: STATE, code: CODE } });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "success",
        token: TOKEN,
      });
      expect(sessionPort.create).toHaveBeenCalledTimes(1);
    });

    it("propagates the session creation error", async () => {
      const error = new GenericError("cannot sign");
      sessionPort.create.mockResolvedValueOnce(err(error));

      const result = await useCase({ callback: { state: STATE, code: CODE } });

      expect(result._unsafeUnwrapErr()).toBe(error);
    });
  });

  describe("error callback", () => {
    it("returns the error with the numeric code from error_description", async () => {
      const result = await useCase({
        callback: {
          state: STATE,
          error: "access_denied" as NonEmptyString,
          error_description: "1002" as NonEmptyString,
        },
      });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: 1002,
        errorMessage: "access_denied",
      });
      expect(sessionPort.create).not.toHaveBeenCalled();
    });

    it("returns a NaN code when error_description is missing", async () => {
      const result = await useCase({
        callback: { state: STATE, error: "access_denied" as NonEmptyString },
      });

      const output = result._unsafeUnwrap();
      expect(output).toMatchObject({
        outcome: "error",
        errorMessage: "access_denied",
      });
      expect(output).toHaveProperty("errorCode", NaN);
      expect(sessionPort.create).not.toHaveBeenCalled();
    });

    it("returns a generic error when the params are not decodable", async () => {
      const result = await useCase({
        callback: {} as never,
      });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: undefined,
        errorMessage: "error occurred",
      });
      expect(sessionPort.create).not.toHaveBeenCalled();
    });
  });
});
