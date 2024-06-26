import * as T from "fp-ts/Task";
import { ProcessResult } from "./process";
import { deepEqual } from "./comparator";

type AwaiterOptions = {
  interval: number;
  timeout: number;
};

/**
 * Await that the provided task returns the expected response
 * @param task An async task
 * @param expectedResult The expected task result
 * @param options Configure the awaiter execution with refresh interval and retry timeout
 * @returns A Process Result with `ok` if succeded of `ko` if fail
 */
export const awaiter: <K>(
  task: T.Task<K>,
  expectedResult: K,
  options?: AwaiterOptions,
) => Promise<ProcessResult> = (
  task,
  expectedResult,
  options = {
    timeout: 0,
    interval: 500,
  },
) =>
  new Promise((resolve, reject) => {
    // eslint-disable-next-line functional/no-let, prefer-const, one-var
    let timer: NodeJS.Timeout, timerTask: NodeJS.Timeout;
    const start = Date.now();
    if (options.timeout > 0) {
      timer = setTimeout(() => {
        // eslint-disable-next-line no-console
        console.error("Timeout riched waiting session-manager become healty");
        clearInterval(timerTask);
        resolve("ko");
      }, options.timeout);
    }
    const fn = (
      r: (value: ProcessResult | PromiseLike<ProcessResult>) => void,
    ) =>
      task()
        .then((result) => {
          if (deepEqual(result, expectedResult)) {
            // eslint-disable-next-line no-console
            console.info(
              `The task become ready after ${Date.now() - start} ms`,
            );
            r("ok");
            clearInterval(timer);
          } else {
            timerTask = setTimeout(() => {
              // eslint-disable-next-line no-console
              fn(r).catch(console.error);
            }, options.interval);
          }
          return void 0;
        })
        .catch(reject);
    // eslint-disable-next-line no-console
    fn(resolve).catch(console.error);
  });
