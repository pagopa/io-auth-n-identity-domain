import * as TE from "fp-ts/lib/TaskEither";
import { vi } from "vitest";

const mockSaveAuditLog = vi.fn().mockReturnValue(() => TE.right(void 0));

export const mockRejectedLoginAuditLogRepository = {
  saveAuditLog: mockSaveAuditLog,
};
