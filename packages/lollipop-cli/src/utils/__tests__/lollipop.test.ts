import { LollipopMethodEnum } from "../../generated/lollipop_definitions/LollipopMethod";
import { LollipopOriginalURL } from "../../generated/lollipop_definitions/LollipopOriginalURL";
import { createLollipopHeaders } from "../lollipop";
import { randomUUID } from "crypto";
import { describe, it, expect } from "vitest";

const anUrl = "https://example.com";
const aNonce = randomUUID({ disableEntropyCache: true });

// the following keypair has been generated on the fly locally
// and it's not associated with any production values
const mockPrivateKeyJwk = {
  kty: "EC",
  x: "vUJBGLozUo1esnNXp_XhepIg3JXE_V8ekU7Ry5AhtCw",
  y: "ue1tUKSO7aQQuGd6D6ZWYkoL4HlxLVYHXP7SgzB3g_M",
  crv: "P-256",
  d: "mk4ger1hdEIjlX7xWfeepAASBbmIEgK3gZNg6gBOtjg"
};
const mockPublicKeyJwk = {
  kty: "EC",
  x: "vUJBGLozUo1esnNXp_XhepIg3JXE_V8ekU7Ry5AhtCw",
  y: "ue1tUKSO7aQQuGd6D6ZWYkoL4HlxLVYHXP7SgzB3g_M",
  crv: "P-256"
};
const aValidInput = {
  method: LollipopMethodEnum.POST,
  url: anUrl as LollipopOriginalURL,
  privateKeyJwk: mockPrivateKeyJwk,
  publicKeyJwk: mockPublicKeyJwk
};

describe("Lollipop utils", () => {
  it("should generate lollipop headers", async () => {
    const result = await createLollipopHeaders(aValidInput)();

    expect(result).toStrictEqual({
      _tag: "Right",
      right: {
        signatureInput: expect.any(String),
        signature: expect.any(String),
        digest: undefined
      }
    });
  });

  it("should generate lollipop headers with digest", async () => {
    const aValidInputWithBody = {
      ...aValidInput,
      body: { foo: "bar" }
    };

    const result = await createLollipopHeaders(aValidInputWithBody)();

    expect(result).toStrictEqual({
      _tag: "Right",
      right: {
        signatureInput: expect.stringContaining("content-digest"),
        signature: expect.any(String),
        digest: expect.stringContaining("sha-256=:")
      }
    });
  });

  it("should generate lollipop headers with nonce", async () => {
    const aValidInputWithNonce = { ...aValidInput, nonce: aNonce };

    const result = await createLollipopHeaders(aValidInputWithNonce)();

    expect(result).toStrictEqual({
      _tag: "Right",
      right: {
        signatureInput: expect.stringContaining(`nonce\=\"${aNonce}\"`),
        signature: expect.any(String),
        digest: undefined
      }
    });
  });

  it.each`
    scenario                   | publicK             | privateK
    ${"invalid publicKeyJwk"}  | ${{}}               | ${mockPrivateKeyJwk}
    ${"invalid privateKeyJwk"} | ${mockPublicKeyJwk} | ${{}}
  `("should fail because of an $scenario", async ({ publicK, privateK }) => {
    const anInvalidInput = {
      ...aValidInput,
      privateKeyJwk: privateK,
      publicKeyJwk: publicK
    };

    const result = await createLollipopHeaders(anInvalidInput)();
    expect(result).toStrictEqual({ _tag: "Left", left: expect.any(Error) });
  });
});
