import { expect, it } from "vitest";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as E from "fp-ts/Either";
import {
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import type express from "express";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { IPString } from "@pagopa/ts-commons/lib/strings";
import { Errors } from "io-ts";
import { WithExpressRequest } from "../express";
import { WithIP, withIPFromRequest } from "../network";
import mockReq from "../../__mocks__/request.mocks";

const dummyHandler: RTE.ReaderTaskEither<
  WithExpressRequest & WithIP,
  Error,
  IResponseSuccessJson<undefined>
> = (_) => TE.right(ResponseSuccessJson(undefined));

it("should return 500 when the user IP has an unexpected value", async () => {
  const wrongIp = "unexpected";
  const decodeErrors = (IPString.decode(wrongIp) as E.Left<Errors>).left;

  const result = await pipe(withIPFromRequest(dummyHandler), (f) =>
    f({ req: mockReq({ ip: wrongIp }) as unknown as express.Request }),
  )();

  expect(result).toEqual(
    E.right({
      ...ResponseErrorInternal(readableReportSimplified(decodeErrors)),
      apply: expect.any(Function),
    }),
  );
});
