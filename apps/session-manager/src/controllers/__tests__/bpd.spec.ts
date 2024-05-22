import { describe, it, vi, expect, beforeEach, assert } from "vitest";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { ResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import { BPDController } from "../index";
import { FnAppAPIClient } from "../../repositories/fn-app-api";
import { mockedUser } from "../../__mocks__/user.mocks";
import { BPDUser } from "../../generated/bpd/BPDUser";
import mockReq from "../../__mocks__/request.mocks";

describe("BPDController#getUserForBPD", () => {
  const req = mockReq() as unknown as express.Request;
  const defaultDeps = {
    fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
    user: mockedUser,
    req,
  };

  const bpdUserResponse: BPDUser = {
    family_name: mockedUser.family_name,
    fiscal_code: mockedUser.fiscal_code,
    name: mockedUser.name,
  };
  const happyPathResponse = ResponseSuccessJson(bpdUserResponse);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the getUserForBPD on the SSOController with valid values", async () => {
    await pipe(
      defaultDeps,
      BPDController.getUserForBPD,
      TE.map((response) => {
        expect(response).toStrictEqual({
          ...happyPathResponse,
          apply: expect.any(Function),
        });
        // expect that no other properties(for example spid_level which is
        // required in user) are present
        expect(response).not.toMatchObject({
          ...happyPathResponse,
          apply: expect.any(Function),
          spid_level: mockedUser.spid_level,
        });
      }),
      TE.mapLeft(() => assert.fail()),
    )();
  });
});
