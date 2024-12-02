import * as E from "fp-ts/Either";

import { Client } from "../../generated/definitions/external/client";
import {
  aValidJwk,
  aValidSha256AssertionRef
} from "../../__mocks__/lollipopPubKey.mock";

import { signedMessageHandler } from "../handler";
import { aSAMLResponse } from "../../__mocks__/assertion.mock";
import {
  aValidPayload,
  firstLcAssertionClientConfig,
  validLollipopLCParamsHeaders
} from "../../__mocks__/lollipopSignature.mock";
import { LollipopOriginalURL } from "../../generated/definitions/lollipop-first-consumer/LollipopOriginalURL";
import { LollipopSignature } from "../../generated/definitions/lollipop-first-consumer/LollipopSignature";
import { LollipopSignatureInput } from "../../generated/definitions/lollipop-first-consumer/LollipopSignatureInput";
import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";

// -----------------
// mocks
// -----------------

const getAssertionMock = jest.fn(async () =>
  E.right({
    status: 200,
    value: { response_xml: aSAMLResponse }
  })
);
const assertionClientMock = ({
  getAssertion: getAssertionMock
} as unknown) as Client<"ApiKeyAuth">;

// -----------------
// tests
// -----------------

describe("FirstLollipopConsumerSignedMessage", () => {
  test(`GIVEN a valid LolliPoP request,
        WHEN all checks passed
        THEN the assertion ref is returned`, async () => {
    const handler = signedMessageHandler(
      assertionClientMock,
      firstLcAssertionClientConfig
    );

    const res = await handler(
      aValidJwk,
      {
        ...validLollipopLCParamsHeaders,
        // ---------
        // verified header
        // ---------
        ["x-pagopa-lollipop-original-method"]:
          firstLcAssertionClientConfig.EXPECTED_FIRST_LC_ORIGINAL_METHOD,
        ["x-pagopa-lollipop-original-url"]: firstLcAssertionClientConfig
          .EXPECTED_FIRST_LC_ORIGINAL_URL.href as LollipopOriginalURL,
        ["signature-input"]: `sig1=("content-digest" "x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url");created=1678293988;nonce="aNonce";alg="ecdsa-p256-sha256";keyid="a7qE0Y0DyqeOFFREIQSLKfu5WlbckdxVXKFasfcI-Dg"` as LollipopSignatureInput,
        ["signature"]: "sig1=:lTuoRytp53GuUMOB4Rz1z97Y96gfSeEOm/xVpO39d3HR6lLAy4KYiGq+1hZ7nmRFBt2bASWEpen7ov5O4wU3kQ==:" as LollipopSignature
      },
      aValidPayload
    );

    expect(res).toMatchObject({
      kind: "IResponseSuccessJson",
      value: { response: aValidSha256AssertionRef }
    });
  });
});
