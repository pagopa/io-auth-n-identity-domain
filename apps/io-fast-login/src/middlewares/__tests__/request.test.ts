import { RequiredBodyMiddleware } from "../request";
import * as t from "io-ts";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as H from "@pagopa/handler-kit";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/lib/TaskEither";
import { aFiscalCode } from "../../functions/__mocks__/general";

const sampleSchema = t.type({
  fiscalcode: FiscalCode,
  sample: NonEmptyString
});
const aValidPayload = { fiscalcode: aFiscalCode, sample: "abc" };
describe("RequiredBodyMiddleware", () => {
  it("should decode successfully", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidPayload
    };

    const result = await pipe(
      mockReq,
      RequiredBodyMiddleware(sampleSchema),
      TE.toUnion
    )();

    expect(result).toStrictEqual(aValidPayload);
  });

  it.each`
    body
    ${{}}
    ${{ fiscalcode: "", sample: "" }}
    ${{ fiscalcode: aValidPayload.fiscalcode, sample: "" }}
    ${{ fiscalcode: "", sample: aValidPayload.sample }}
    ${{ fiscalcode: "anInvalidFiscalCode", sample: aValidPayload.sample }}
  `("should fail while decoding and return an HTTP error", async ({ body }) => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body
    };

    const result = await pipe(
      mockReq,
      RequiredBodyMiddleware(sampleSchema),
      TE.toUnion
    )();

    expect(result).toBeInstanceOf(Error);
  });
});
