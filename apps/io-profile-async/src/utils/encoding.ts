export const base64EncodeObject = <T>(item: T): string =>
  Buffer.from(JSON.stringify(item)).toString("base64");
