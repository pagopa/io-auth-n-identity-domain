import type { NonEmptyString } from "@pagopa/hexagonal-core";
import type {
  LollipopAssertionRef,
  LollipopAssertionType,
} from "@pagopa/io-auth-n-identity-domain";

export type IdentityAssertion = {
  assertionRef: LollipopAssertionRef;
  rawAssertion: NonEmptyString;
  assertion: Document;
  type: LollipopAssertionType;
};
