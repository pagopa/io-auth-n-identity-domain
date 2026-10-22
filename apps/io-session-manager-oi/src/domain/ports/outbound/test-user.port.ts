import type { FiscalCode } from "@pagopa/hexagonal-core";

export interface TestUserPort {
  readonly isTestUser: (fiscalCode: FiscalCode) => boolean;
}
