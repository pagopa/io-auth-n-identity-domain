import { z } from "zod";

export const CidrV4ReadonlyArray = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
  .pipe(z.array(z.cidrv4()))
  .readonly();
