export function assertUnreachable(_: never): never {
  throw new Error("Unexpected type error");
}
