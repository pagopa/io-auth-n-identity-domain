import * as E from "fp-ts/Either";
import * as crypto from "crypto";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";

import { config } from "../../__mocks__/config.mock";
import { getGenerateJWE } from "../jwe";

describe(`getGenerateJWE`, () => {
  it("should return a valid JWE", async () => {
    const issuer = "pagopa" as NonEmptyString;
    const ttl = 900 as Second;
    const jti = crypto.randomUUID() as NonEmptyString;
    const iat = Date.now();

    const aValidPayload = {
      family_name: "fn",
      fiscal_number: "fc",
      name: "n"
    };

    const result = await getGenerateJWE(
      issuer,
      jti,
      iat,
      config.MAGIC_LINK_JWE_PRIMARY_PUB_KEY
    )(aValidPayload, ttl)();

    expect(result).toMatchObject(
      E.right(expect.stringMatching(`[A-Za-z0-9-_]{1,520}`))
    );
  });
});
