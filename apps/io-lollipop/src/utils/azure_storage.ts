import * as TE from "fp-ts/TaskEither";

export const streamToText = (
  readable: NodeJS.ReadableStream
): TE.TaskEither<Error, string> =>
  TE.tryCatch(
    async () => {
      readable.setEncoding("utf8");

      // eslint-disable-next-line functional/no-let
      let result = "";
      for await (const chunk of readable as AsyncIterable<string | Buffer>) {
        result += chunk.toString();
      }
      return result;
    },
    reason => (reason instanceof Error ? reason : new Error(String(reason)))
  );
