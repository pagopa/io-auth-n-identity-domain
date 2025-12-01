import * as TE from "fp-ts/lib/TaskEither";
import { vi } from "vitest";

const mockUpsertBlobFromText = vi.fn().mockReturnValue(TE.right(void 0));

export const mockBlobUtils = {
  upsertBlobFromText: mockUpsertBlobFromText,
};
