import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as df from "durable-functions";
import { OrchestrationContext, Task } from "durable-functions";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { initTelemetryClient } from "../utils/appinsights";
import { computeDailyProfileFeedOperation } from "../utils/profiles";
import { toHash } from "../utils/crypto";
import {
  ActivityName as GetProfileVersionsForRecoveryActivityName,
  ActivityResult as GetProfileVersionsForRecoveryActivityResult,
  ActivityInput as GetProfileVersionsForRecoveryActivityInput,
} from "./get-profile-versions-for-recovery-activity";
import {
  ActivityName as UpdateSubscriptionFeedActivityName,
  Input as UpdateSubscriptionFeedActivityInput,
} from "./update-subscriptions-feed-activity";

/**
 * Input of the recovery orchestrator: the fiscal code and the UTC day to
 * recompute. Passing only these two values makes the orchestration fully
 * idempotent for a given (fiscal code, day) pair.
 */
export const OrchestratorInput = t.type({
  fiscalCode: FiscalCode,
  day: t.string,
});
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const OrchestratorName = "RecoverSubscriptionsFeedOrchestrator";
const logPrefix = OrchestratorName;

type RecoveryStep = "READ_PREVIOUS_VERSION" | "UPDATE_FEED";

/**
 * Factory for the recovery orchestrator handler.
 *
 * The orchestrator processes all profile versions from the same UTC day and
 * emits the matching profile-level subscription feed event once. It never throws:
 * any residual failure is tracked and the orchestrator returns false, accepting
 * the known drift trade-off described in the recovery RFC.
 *
 * @param deps.telemetryClient - the App Insights telemetry client
 * @param deps.dryRun - when true, only tracks the intended operation without calling UpdateSubscriptionFeedActivity
 * @returns the orchestrator generator
 */
// eslint-disable-next-line max-lines-per-function
export const getRecoverSubscriptionsFeedOrchestratorHandler = ({
  telemetryClient,
  dryRun,
  startDate = 0,
  endDate = Number.MAX_SAFE_INTEGER,
}: {
  readonly telemetryClient: ReturnType<typeof initTelemetryClient>;
  readonly dryRun: boolean;
  readonly startDate?: number;
  readonly endDate?: number;
}) =>
  // eslint-disable-next-line max-lines-per-function, complexity
  function* (context: OrchestrationContext): Generator<Task, boolean, unknown> {
    const retryOptions = new df.RetryOptions(5000, 3);
    retryOptions.backoffCoefficient = 1.5;

    const input = context.df.getInput();
    const errorOrOrchestratorInput = OrchestratorInput.decode(input);

    if (E.isLeft(errorOrOrchestratorInput)) {
      if (!context.df.isReplaying) {
        context.error(
          `${logPrefix}|Error decoding input|ERROR=${readableReport(
            errorOrOrchestratorInput.left,
          )}`,
        );
      }
      return false;
    }

    const { fiscalCode, day } = errorOrOrchestratorInput.right;

    if (!context.df.isReplaying) {
      context.trace(
        `${logPrefix}|START|fiscalCode=${fiscalCode}|day=${day}|dryRun=${dryRun}`,
      );
    }

    let step: RecoveryStep = "READ_PREVIOUS_VERSION";

    /**
     * Helper to emit an unsampled recovery failure event keyed by the fiscal
     * code hash. Defined locally so it can capture the current step.
     */
    const trackFailure = (
      kind: "EXCEPTION" | "NOT_FOUND",
      version?: number,
    ) => {
      telemetryClient?.trackEvent({
        name: "subscriptionFeed.recovery.failure",
        properties: {
          fiscalCode: toHash(fiscalCode),
          kind,
          step,
          ...(version !== undefined && {
            version: version.toString(),
          }),
        },
        tagOverrides: { samplingEnabled: "false" },
      });
    };

    try {
      const dayStart = new Date(`${day}T00:00:00.000Z`);
      dayStart.setUTCHours(0, 0, 0, 0);
      const utcDayStartTimestamp = dayStart.getTime() / 1000;
      const dayStartTimestamp = Math.max(
        utcDayStartTimestamp,
        startDate / 1000,
      );
      const dayEndTimestamp = Math.min(
        utcDayStartTimestamp + 24 * 60 * 60,
        endDate / 1000,
      );

      const recoveryResultJson = yield context.df.callActivityWithRetry(
        GetProfileVersionsForRecoveryActivityName,
        retryOptions,
        GetProfileVersionsForRecoveryActivityInput.encode({
          fiscalCode,
          startTimestamp: dayStartTimestamp,
          endTimestamp: dayEndTimestamp,
        }),
      );

      const recoveryResult = pipe(
        GetProfileVersionsForRecoveryActivityResult.decode(recoveryResultJson),
        E.getOrElseW((errors) => {
          if (!context.df.isReplaying) {
            context.error(
              `${logPrefix}|Cannot decode GetProfileVersionsForRecoveryActivity result|ERROR=${readableReport(
                errors,
              )}`,
            );
          }
          throw new Error("Invalid activity result");
        }),
      );

      if (recoveryResult.kind === "NOT_FOUND") {
        if (!context.df.isReplaying) {
          context.warn(`${logPrefix}|No profile version found|day=${day}`);
        }
        trackFailure("NOT_FOUND");
        return false;
      }

      if (recoveryResult.kind === "TRANSIENT_FAILURE") {
        if (!context.df.isReplaying) {
          context.error(
            `${logPrefix}|GetProfileVersionsForRecoveryActivity returned a transient failure|day=${day}|REASON=${recoveryResult.reason}`,
          );
        }
        trackFailure("EXCEPTION");
        return false;
      }

      const { previousMode, currentDayModes, lastVersion, lastTimestamp } = recoveryResult;

      if (currentDayModes.length === 0) {
        throw new Error(
          "GetProfileVersionsForRecoveryActivity returned no modes",
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const operation: "SUBSCRIBED" | "UNSUBSCRIBED" | undefined =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        computeDailyProfileFeedOperation(previousMode, currentDayModes);

      if (operation === undefined) {
        if (!context.df.isReplaying) {
          context.trace(
            `${logPrefix}|No feed operation needed|version=${lastVersion}`,
          );
        }
        return true;
      }

      step = "UPDATE_FEED";

      if (!context.df.isReplaying) {
        context.trace(
          `${logPrefix}|Operation=${operation}|version=${lastVersion}|dryRun=${dryRun}`,
        );
      }

      if (dryRun) {
        telemetryClient?.trackEvent({
          name: "subscriptionFeed.recovery.dryRun",
          properties: {
            fiscalCode: toHash(fiscalCode),
            operation,
            version: lastVersion.toString(),
          },
          tagOverrides: { samplingEnabled: "false" },
        });
        return true;
      }

      yield context.df.callActivityWithRetry(
        UpdateSubscriptionFeedActivityName,
        retryOptions,
        {
          fiscalCode,
          operation,
          subscriptionKind: "PROFILE",
          updatedAt: lastTimestamp * 1000,
          version: lastVersion,
        } as UpdateSubscriptionFeedActivityInput,
      );

      return true;
    } catch (e) {
      if (!context.df.isReplaying) {
        context.error(`${logPrefix}|Recovery failed|step=${step}|ERROR=${String(e)}`);
      }
      trackFailure("EXCEPTION");
      return false;
    }
  };
