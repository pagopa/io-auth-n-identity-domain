import { ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import { aBaseSession } from "../../../__mocks__/session.mocks.js";
import { getUserForBpdUseCase } from "../get-user-for-bpd.use-case.js";

describe("getUserForBpdUseCase", () => {
  it("maps the session to the BPD user response", async () => {
    const result = await getUserForBpdUseCase({ session: aBaseSession });

    expect(result).toEqual(
      ok({
        name: aBaseSession.name,
        family_name: aBaseSession.familyName,
        fiscal_code: aBaseSession.fiscalCode,
      }),
    );
  });
});
