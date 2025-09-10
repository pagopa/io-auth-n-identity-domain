import { describe, test, expect } from "vitest";

import { decompressFiscalCodeList } from "../login";

describe("Config#login", () => {
  test("decode compressed list of fiscal code", async () => {
    const base64 =
      "H4sIAAAAAAAA/2TVTWocVxxH0Q3VoG5911CymwTbA8WWlY73v5BQFqjJyZ83+sGDOzu33zeO7298GhieHT45fHa4DU+/bxzf3/jJ4bPD/748Dy/f316+v03r09if69jzcL/u5WP4Nvxz3WP4Ony97jH8HP667jH8GP6+7jE8Db+uewxfhi/XPYb78Md1j+HX8O3t9fbj9aP0zpDD5DA7LA6rw+awOxwOJ0OWZmmWZmmWZmmWZmmWZulk6WTpZOlk6WTpZOlk6WTpZOlk6WzpbOls6WzpbOls6WzpbOls6WzpYuli6WLpYuli6WLpYuli6WLpYulq6Wrpaulq6Wrpaulq6Wrpaulq6WbpZulm6WbpZulm6WbpZulm6Wbpbulu6W7pbulu6W7pbulu6W7pbulh6WHpYelh6WHpYelh6WHpYelh6Wnpaelp6Wnpaelp6Wnpaelp6UlpGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFpVBqVRqVRaVQalUalUWlUGpVGpVFdRv283V4/0LqM+u/Q/V8AAAD//wEAAP//vUy2gZsOAAA=";

    const expected: string[] = [
      "EEEEEE00E00E000A",
      "EEEEEE00E00E000B",
      "EEEEEE00E00E000C",
      "EEEEEE00E00E000D",
      "EEEEEE00E00E000E",
      "AAAAAA00A00A000C",
      "AAAAAA00A00A000D",
      "AAAAAA00A00A000E",
      "AAAAAA00A00A000B",
      "PRVPRV25A01H501B",
      "XXXXXP25A01H501L",
      "YYYYYP25A01H501K",
      "KKKKKP25A01H501U",
      "QQQQQP25A01H501S",
      "WWWWWP25A01H501A",
      "ZZZZZP25A01H501J",
      "JJJJJP25A01H501X",
      "GGGGGP25A01H501Z",
      ...Array.from(
        { length: 200 },
        (_, i) => `LVTEST00A00A${i.toString().padStart(3, "0")}X`,
      ),
      "UEETST00A00A000X",
      "UEETST00A00A001X",
    ];

    const result = decompressFiscalCodeList(base64);
    expect(result).toMatchObject(expected);
  });
});
