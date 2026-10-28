import type { FiscalCode, NonEmptyString } from "@pagopa/hexagonal-core";

export interface TestUserPort {
  readonly isTestUser: (fiscalCode: FiscalCode) => boolean;
  readonly isTestCredentials: (fiscalCode: FiscalCode, password: NonEmptyString) => boolean;
}
