/**
 * Encodes a value as Base64.
 *
 * Strings and binary values are encoded as-is; objects are JSON serialized.
 */
export const encode = <T>(value: T): string => {
  const valueToEncode = toBufferInput(value);

  return Buffer.from(valueToEncode).toString("base64");
};

const toBufferInput = (value: unknown): string | Uint8Array => {
  if (typeof value === "string" || value instanceof Uint8Array) {
    return value;
  }

  if (value === null || typeof value !== "object") {
    return String(value);
  }

  return JSON.stringify(value, (_key, nestedValue: unknown) =>
    typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
  );
};
