import type { FiscalCode } from "@pagopa/hexagonal-core";

import type { TestUserPort } from "../../domain/ports/outbound/test-user.port.js";
import type { LoginConfig } from "../../domain/value-objects/configs/login.vo.js";

export class InMemoryTestUserAdapter implements TestUserPort {
  private readonly testUsers: ReadonlySet<FiscalCode>;

  constructor(config: Pick<LoginConfig, "TEST_LOGIN_FISCAL_CODES_COMPRESSED">) {
    this.testUsers = config.TEST_LOGIN_FISCAL_CODES_COMPRESSED;
  }

  isTestUser(fiscalCode: FiscalCode): boolean {
    return this.testUsers.has(fiscalCode);
  }
}
