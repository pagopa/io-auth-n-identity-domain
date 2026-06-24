// A LolliPoP valid SignatureInput with multiple signature
export const aValidMultiSignatureInput = `sig1=("@method" "@authority" "@path" "content-digest" "content-type" "content-length" "x-pagopa-original-url" "x-pagopa-original-method");created=1618884475;keyid="test-key-ecc-p256", sig2=("@method" "@authority" "@path" "content-digest" "content-type" "content-length" "forwarded");created=1618884480;keyid="test-key-rsa";alg="rsa-v1_5-sha256";expires=1618884540`;
// A LolliPoP valid SignatureInput with single signature
export const aValidSingleSignatureInput = `sig1=("@method" "@authority" "@path" "content-digest" "content-type" "content-length" "x-pagopa-original-url" "x-pagopa-original-method");created=1618884475;keyid="test-key-ecc-p256"`;
