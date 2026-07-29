import { InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import * as E from "fp-ts/lib/Either";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { initTelemetryClient } from "../utils/appinsights";
import { toHash } from "../utils/crypto";
import { startSingletonOrchestrator } from "../utils/durable";
import { OrchestratorInput as RecoverSubscriptionsFeedOrchestratorInput } from "./recover-subscriptions-feed-orchestrator";

type Dependencies = {
  readonly telemetryClient: ReturnType<typeof initTelemetryClient>;
  readonly dryRun: boolean;
  readonly startDate: number;
  readonly endDate: number;
  readonly leasePrefix: string;
};

const ORCHESTRATOR_NAME = "RecoverSubscriptionsFeedOrchestrator";
const logPrefix = "RecoverSubscriptionsFeed";

/**
 * Cosmos DB trigger handler that processes a batch of changed profile
 * documents and starts a recovery orchestrator for each valid entry.
 *
 * The Cosmos DB trigger already maintains its own checkpoint state in the
 * configured lease container, so no custom continuation-token store is
 * required. Each invocation receives the documents that changed since the
 * last checkpoint.
 *
 * The lease prefix is appended to the orchestration instance id so that every
 * recovery pass gets its own deduplication namespace: a pass started with a
 * new prefix replays the whole window from scratch and is not skipped because
 * of the completed instances of a previous pass (e.g. a dry-run).
 *
 * @param deps - the handler dependencies
 * @returns the Cosmos DB trigger handler function
 */
export const RecoverSubscriptionsFeed = (deps: Dependencies) =>
  async (
    documents: ReadonlyArray<unknown>,
    context: InvocationContext,
  ): Promise<void> => {
    context.trace(
      `${logPrefix}|START|documents=${documents.length}|dryRun=${deps.dryRun}|leasePrefix=${deps.leasePrefix}`,
    );

    const dfClient = df.getClient(context);
    let processedInstanceIds: ReadonlySet<string> = new Set();

    for (const rawProfile of documents) {
      const decodedProfile = RetrievedProfile.decode(rawProfile);

      if (E.isLeft(decodedProfile)) {
        context.error(
          `${logPrefix}|Cannot decode profile from change feed|ERROR=${readableReportSimplified(
            decodedProfile.left,
          )}`,
        );
        deps.telemetryClient?.trackEvent({
          name: "subscriptionFeed.recovery.badRecord",
          properties: {
            kind: "DECODE_ERROR",
          },
          tagOverrides: { samplingEnabled: "false" },
        });
        continue;
      }

      const profile = decodedProfile.right;
      const changedAt = profile._ts * 1000;

      if (changedAt < deps.startDate || changedAt >= deps.endDate) {
        continue;
      }

      const date = new Date(changedAt).toISOString().substring(0, 10);
      const instanceId = `recover-subfeed-${toHash(profile.fiscalCode)}-${date}-${deps.leasePrefix}`;

      if (processedInstanceIds.has(instanceId)) {
        continue;
      }

      processedInstanceIds = new Set(processedInstanceIds).add(instanceId);

      const startResult = await startSingletonOrchestrator(
        dfClient,
        ORCHESTRATOR_NAME,
        instanceId,
        { fiscalCode: profile.fiscalCode, date },
        RecoverSubscriptionsFeedOrchestratorInput,
      )();

      if (E.isLeft(startResult)) {
        context.error(
          `${logPrefix}|Cannot start orchestrator|instanceId=${instanceId}|ERROR=${startResult.left.message}`,
        );
        deps.telemetryClient?.trackEvent({
          name: "subscriptionFeed.recovery.startError",
          properties: {
            fiscalCode: toHash(profile.fiscalCode),
            instanceId,
            kind: "START_FAILED",
            version: profile.version.toString(),
          },
          tagOverrides: { samplingEnabled: "false" },
        });
        throw startResult.left;
      }
    }
  };
