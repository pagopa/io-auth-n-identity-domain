import * as jose from "jose";

import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";

// this method generates new JWK for use in the describe below
export const generateJwkForTest = async (): Promise<JwkPublicKey> => {
  const keyPair = await jose.generateKeyPair("ES256");
  return (await jose.exportJWK(keyPair.publicKey)) as JwkPublicKey;
};

export const generateAssertionRefForTest = async (
  jwk: JwkPublicKey,
  algo: JwkPubKeyHashAlgorithmEnum = JwkPubKeyHashAlgorithmEnum.sha256
): Promise<AssertionRef> => {
  const thumbprint = await jose.calculateJwkThumbprint(jwk, algo);
  return `${algo}-${thumbprint}` as AssertionRef;
};
