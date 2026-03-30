import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { flow } from "fp-ts/lib/function";
import { TelemetryClient } from "applicationinsights";

/**
 * Log function input — matches the winston-ts LogFunction<A> API.
 * Accepts a static string/tuple, or a function that receives the
 * monad value and returns a string/tuple.
 */
export type LogInput<A> =
  | string
  | readonly [string, unknown]
  | ((a: A) => string | readonly [string, unknown]);

const processLogInput = <A>(
  fn: LogInput<A>,
  item: A,
): readonly [string, Record<string, unknown> | undefined] => {
  const raw = fn instanceof Function ? fn(item) : fn;
  return typeof raw === "string"
    ? [raw, undefined]
    : [raw[0], raw[1] as Record<string, unknown> | undefined];
};

type Peeker<A> = (item: A) => A;

/**
 * Public interface that mirrors the subset of winston-ts API used in
 * io-lollipop:  taskEither.{errorLeft, info}, peek.{error, info},
 * either.{errorLeft}.
 */
export interface Logger {
  readonly taskEither: {
    readonly errorLeft: <E, A>(
      fn: LogInput<E>,
    ) => (ma: TE.TaskEither<E, A>) => TE.TaskEither<E, A>;
    readonly info: <E, A>(
      fn: LogInput<A>,
    ) => (ma: TE.TaskEither<E, A>) => TE.TaskEither<E, A>;
  };
  readonly peek: {
    readonly error: <A>(fn: LogInput<A>) => Peeker<A>;
    readonly info: <A>(fn: LogInput<A>) => Peeker<A>;
  };
  readonly either: {
    readonly errorLeft: <E, A>(
      fn: LogInput<E>,
    ) => (ma: E.Either<E, A>) => E.Either<E, A>;
  };
}

/**
 * Creates a Logger that sends events to Application Insights via
 * `telemetryClient.trackEvent()`.
 *
 * Event format matches `withApplicationInsight` from io-functions-commons:
 * ```
 * { name: "<prefix>.<level>.<meta.name ?? 'global'>",
 *   properties: { message, ...rest },
 *   tagOverrides: { samplingEnabled: "false" } }
 * ```
 */
export const createApplicationInsightsLogger = (
  telemetryClient: TelemetryClient,
  prefix: string,
): Logger => {
  const emitEvent =
    <A>(level: string, fn: LogInput<A>): Peeker<A> =>
    (item) => {
      const [message, meta] = processLogInput(fn, item);
      const { name: eventName, ...rest } = (meta ?? {});
      telemetryClient.trackEvent({
        name: `${prefix}.${level}.${(eventName as string | undefined) ?? "global"}`.toLowerCase(),
        properties: { message, ...rest },
        tagOverrides: { samplingEnabled: "false" },
      });
      return item;
    };

  return {
    taskEither: {
      errorLeft: <E, A>(fn: LogInput<E>) =>
        flow(TE.mapLeft(emitEvent<E>("error", fn))) as (
          ma: TE.TaskEither<E, A>,
        ) => TE.TaskEither<E, A>,
      info: <E, A>(fn: LogInput<A>) =>
        flow(TE.map(emitEvent<A>("info", fn))) as (
          ma: TE.TaskEither<E, A>,
        ) => TE.TaskEither<E, A>,
    },
    peek: {
      error: <A>(fn: LogInput<A>): Peeker<A> => emitEvent("error", fn),
      info: <A>(fn: LogInput<A>): Peeker<A> => emitEvent("info", fn),
    },
    either: {
      errorLeft: <E, A>(fn: LogInput<E>) =>
        flow(E.mapLeft(emitEvent<E>("error", fn))) as (
          ma: E.Either<E, A>,
        ) => E.Either<E, A>,
    },
  };
};
