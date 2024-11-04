import { PatternString } from "@pagopa/ts-commons/lib/strings";
import { LollipopSignatureInput } from "../generated/definitions/internal/LollipopSignatureInput";
import * as E from "fp-ts/Either";

// A LolliPoP valid SignatureInput with multiple signature
const aValidMultiSignatureInput = `sig1=("@method" "@authority" "@path" "content-digest" "content-type" "content-length" "x-pagopa-original-url" "x-pagopa-original-method");created=1618884475;keyid="test-key-ecc-p256", sig2=("@method" "@authority" "@path" "content-digest" "content-type" "content-length" "forwarded");created=1618884480;keyid="test-key-rsa";alg="rsa-v1_5-sha256";expires=1618884540`;
// A LolliPoP valid SignatureInput with single signature
const aValidSingleSignatureInput = `sig1=("@method" "@authority" "@path" "content-digest" "content-type" "content-length" "x-pagopa-original-url" "x-pagopa-original-method");created=1618884475;keyid="test-key-ecc-p256"`;

// The following string is an example of input value that can execute a ReDOS
// attack over the old regex "^(((sig[0-9]+)=[^,]*?)(, ?)?)+$"
const attackValue = "sig0=, " + "sig0=sig0=, ".repeat(27) + ",s";
const anInvalidSignatureInput = `anInvalidStringInput`;

describe("LollipopSignatureInput type decoder", () => {
  it("should decode successfully a valid signature-input string", () => {
    const multiSignatureResult = LollipopSignatureInput.decode(
      aValidMultiSignatureInput
    );
    const singleSignatureResult = LollipopSignatureInput.decode(
      aValidSingleSignatureInput
    );
    expect(E.isRight(multiSignatureResult)).toBeTruthy();
    expect(E.isRight(singleSignatureResult)).toBeTruthy();
  });

  it("should return an error if an invalid signatur-input is provided", () => {
    const result = LollipopSignatureInput.decode(anInvalidSignatureInput);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should be safe process a string that cause a ReDOS on the old regex ^(((sig[0-9]+)=[^,]*?)(, ?)?)+$", () => {
    const result = LollipopSignatureInput.decode(attackValue);
    expect(E.isLeft(result)).toBeTruthy();
  });
});
