import { describe, test, expect, vi, afterEach } from "vitest";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import {
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as RTE from "fp-ts/ReaderTaskEither";
import { Request } from "express";
import { mockedUser } from "../../__mocks__/user.mocks";
import mockReq from "../../__mocks__/request.mocks";
import { WithUser, withUserFromRequest } from "../user";

const mockedHandler: RTE.ReaderTaskEither<
  WithUser,
  Error,
  IResponseSuccessJson<{ ok: string }>
> = vi.fn().mockImplementation(() => TE.of(ResponseSuccessJson({ ok: "ok" })));

const mockedRequest = mockReq({ user: mockedUser }) as unknown as Request;
describe("UserUtils#withUserFromRequest", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  test("should call an handler with the input dependencies and the user retrieved from the Express request", async () => {
    await pipe(
      withUserFromRequest(mockedHandler)({
        req: mockedRequest,
      }),
      TE.map((response) =>
        expect(response.kind).toEqual("IResponseSuccessJson"),
      ),
    )();
    expect(mockedHandler).toBeCalledWith({
      req: mockedRequest,
      user: mockedUser,
    });
  });

  test("should return a vaidation error response if the user is invalid", async () => {
    const anInvalidUser = { ...mockedUser, fiscal_code: "invalid_fiscal_code" };
    const invalidMockedRequest = mockReq({
      user: anInvalidUser,
    }) as unknown as Request;

    await pipe(
      withUserFromRequest(mockedHandler)({
        req: invalidMockedRequest,
      }),
      TE.map((response) =>
        expect(response.kind).toEqual("IResponseErrorValidation"),
      ),
    )();
    expect(mockedHandler).not.toBeCalled();
  });
});
