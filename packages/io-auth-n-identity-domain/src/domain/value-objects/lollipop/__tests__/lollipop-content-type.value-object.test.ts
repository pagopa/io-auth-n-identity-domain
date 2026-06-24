import { describe, expect, it } from "vitest";

import { LollipopContentTypeSchema } from "../lollipop-content-type.value-object.js";

describe("LollipopContentTypeSchema", () => {
  it.each(["application/json", "application/octet-stream"])(
    'accepts "%s"',
    (value) => {
      expect(LollipopContentTypeSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each(["", "text/plain", "application/xml", "APPLICATION/JSON"])(
    'rejects "%s"',
    (value) => {
      expect(LollipopContentTypeSchema.safeParse(value).success).toBe(false);
    },
  );
});
