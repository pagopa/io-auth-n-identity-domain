import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/function";
import * as df from "durable-functions";
import * as t from "io-ts";

/**
 * Util function that takes a generator and executes each step until is done.
 * It is meant to be a test utility
 *
 * @param gen a generator function
 * @returns the last value yielded by the generator
 */
export const consumeGenerator = <TReturn = unknown>(
  gen: Generator<unknown, TReturn, unknown>,
): TReturn => {
  let prevValue: unknown;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = gen.next(prevValue);
    if (done) {
      return value;
    }
    prevValue = value;
  }
};

/**
 * In `durable-functions` v3 the method **throws** when the Durable Task
 * extension replies with HTTP 404 (instance not found), whereas in v2 it
 * silently returned a `DurableOrchestrationStatus` object.  We detect this
 * specific error by inspecting the error message for the well-known
 * substring emitted by the library.
 */
const isInstanceNotFoundError = (error: Error): boolean =>
  error.message?.includes("HTTP 404");

export const isOrchestratorRunning = (
  client: df.DurableClient,
  orchestratorId: string,
): TE.TaskEither<
  Error,
  df.DurableOrchestrationStatus & {
    readonly isRunning: boolean;
  }
> =>
  pipe(
    TE.tryCatch(() => client.getStatus(orchestratorId), E.toError),
    TE.map((status) => ({
      ...status,
      isRunning:
        status.runtimeStatus === df.OrchestrationRuntimeStatus.Running ||
        status.runtimeStatus === df.OrchestrationRuntimeStatus.Pending,
    })),
    TE.orElse((error) =>
      isInstanceNotFoundError(error)
        ? TE.of({
            createdTime: new Date(0),
            input: null,
            instanceId: orchestratorId,
            isRunning: false as const,
            lastUpdatedTime: new Date(0),
            name: orchestratorId,
            output: null,
            runtimeStatus:
              "Unknown" as unknown as df.OrchestrationRuntimeStatus,
          } as df.DurableOrchestrationStatus & { readonly isRunning: false })
        : TE.left(error),
    ),
  );

/**
 * Check if the orchestrator is not running or pending, running it otherwise
 *
 * @param {df.DurableClient} dfClient
 * @param {string} orchestratorName
 * @param {string} orchestratorId
 * @param {unknown} orchestratorInput
 * @returns a TaskEither with a startup Error or instanceId
 * */
export const startOrchestrator = <OInput>(
  dfClient: df.DurableClient,
  orchestratorName: string,
  orchestratorId: string,
  orchestratorInput: OInput,
  orchestratorInputCodec: t.Type<OInput, unknown, unknown>,
): TE.TaskEither<Error, string> =>
  pipe(
    isOrchestratorRunning(dfClient, orchestratorId),
    TE.chain((errorOrOrchestratorStatus) =>
      !errorOrOrchestratorStatus.isRunning
        ? pipe(
            TE.tryCatch(
              async () => orchestratorInputCodec.encode(orchestratorInput),
              () => new Error("Encode operation failed"),
            ),
            TE.chain((encodedInput) =>
              TE.tryCatch(
                () =>
                  dfClient.startNew(orchestratorName, {
                    instanceId: orchestratorId,
                    input: encodedInput,
                  }),
                E.toError,
              ),
            ),
          )
        : // if the orchestrator is already running, just return the id
          TE.of(orchestratorId),
    ),
  );

/** Transient error that describes a NOT_YET_IMPLEMENTED , currently used
 * in the activities that retrieve the magic code and geolocation data during
 * a login email sending flow
 * */
export const TransientNotImplementedFailure = t.type({
  kind: t.literal("NOT_YET_IMPLEMENTED"),
  reason: t.string,
});
export type TransientNotImplementedFailure = t.TypeOf<
  typeof TransientNotImplementedFailure
>;
