import type { FiscalCode, NonEmptyString } from "@pagopa/hexagonal-core";

import type { TestUserPort } from "../../domain/ports/outbound/test-user.port.js";
import type { TestLoginConfig } from "../../domain/value-objects/configs/test-login.vo.js";

export class InMemoryTestUserAdapter implements TestUserPort {
  private readonly testUsers: ReadonlySet<FiscalCode>;
  private readonly testPassword: NonEmptyString;

  constructor(config: TestLoginConfig) {
    this.testUsers = config.TEST_LOGIN_FISCAL_CODES_COMPRESSED;
    this.testPassword = config.TEST_LOGIN_PASSWORD;
  }

  isTestUser(fiscalCode: FiscalCode): boolean {
    return this.testUsers.has(fiscalCode);
  }

  isTestCredentials(fiscalCode: FiscalCode, password: NonEmptyString): boolean {
    return this.isTestUser(fiscalCode) && this.testPassword === password;
  }
}
