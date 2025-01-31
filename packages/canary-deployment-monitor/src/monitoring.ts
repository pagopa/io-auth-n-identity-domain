import {
  LogsQueryClient,
  LogsQueryResultStatus,
  LogsTable,
} from "@azure/monitor-query";
import { DefaultAzureCredential } from "@azure/identity";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { getCanaryConfigOrExit } from "./env";
import { logger } from "./logger";

type IncrementOutput = {
  nextIncrementPercentage: number;
  afterMs: number;
  failedRequests: number;
  totalRequests: number;
};

type SwapOutput = {
  swap: boolean;
};

type ScriptOutput = IncrementOutput | SwapOutput;

export type RequestsQueryParams = {
  query: string;
  totalRequestKey: string;
  failureRequestKey: string;
  failureThreshold: number;
};

const config = getCanaryConfigOrExit();

export async function calculateNextStep(
  currentPercentage: number,
  requetsQueryParams: RequestsQueryParams[],
) {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const azureLogAnalyticsWorkspaceId = process.env.LOG_ANALITYCS_WORKSPACE_ID;
  const logsQueryClient = new LogsQueryClient(new DefaultAzureCredential());

  if (!azureLogAnalyticsWorkspaceId) {
    logger.error("LOG_ANALITYCS_WORKSPACE_ID is not set.");
    process.exit(1);
  }

  try {
    const requests = await Promise.all(
      requetsQueryParams.map(async (params) => {
        const result = await logsQueryClient.queryWorkspace(
          azureLogAnalyticsWorkspaceId,
          params.query,
          {
            duration: `PT${Math.floor(config.CANARY_NEXT_STEP_AFTER_MS / 60000)}M`,
          },
        );
        if (result.status === LogsQueryResultStatus.Success) {
          const tablesFromResult: LogsTable[] = result.tables;

          if (tablesFromResult.length === 0) {
            logger.error(`No results for query '${params.query}'`);
            return;
          }
          const table = processTables(tablesFromResult);
          const totalRequests = pipe(
            NonNegativeInteger.decode(table[0][params.totalRequestKey]),
            E.getOrElseW(() => {
              throw new Error("Invalid value from query");
            }),
          );
          const failedRequests = pipe(
            NonNegativeInteger.decode(table[0][params.failureRequestKey]),
            E.getOrElseW(() => {
              throw new Error("Invalid value from query");
            }),
          );
          const failureRate = (failedRequests / totalRequests) * 100;

          if (failureRate > params.failureThreshold && !isNaN(failureRate)) {
            logger.error(
              "Failure rate exceeds acceptable threshold or invalid.",
            );
            process.exit(1);
          }
          return { failedRequests, totalRequests };
        } else {
          logger.error("No data returned from Lognalitycs");
          process.exit(1);
        }
      }),
    ).catch((err) => {
      logger.error(`Error executing some query: ${err}`);
      return [
        {
          totalRequests: 1 as NonNegativeInteger,
          failedRequests: 1 as NonNegativeInteger,
        },
      ];
    });

    const nextPercentage = currentPercentage + config.CANARY_INCREMENT_STEP;

    if (nextPercentage >= 100) {
      const output: SwapOutput = { swap: true };
      scriptOutput(output);
    } else {
      const output: IncrementOutput = {
        nextIncrementPercentage: nextPercentage,
        afterMs: config.CANARY_NEXT_STEP_AFTER_MS,
        ...requests.reduce(
          (prev, req) => ({
            totalRequests: prev.totalRequests + (req?.totalRequests || 0),
            failedRequests: prev.failedRequests + (req?.failedRequests || 0),
          }),
          { totalRequests: 0, failedRequests: 0 },
        ),
      };
      scriptOutput(output);
    }

    process.exit(0);
  } catch (err) {
    logger.error("Error executing the query: ", err);
    process.exit(1);
  }
}

function processTables(
  tablesFromResult: LogsTable[],
): Array<Record<string, unknown>> {
  for (const table of tablesFromResult) {
    const columns = table.columnDescriptors.map((column) => column.name);
    return table.rows.map((row) =>
      row.reduce(
        (prev: Record<string, unknown>, columnValue, index) => ({
          ...prev,
          [`${columns[index]}`]: columnValue,
        }),
        {} as Record<string, unknown>,
      ),
    );
  }
  return [];
}

const scriptOutput = (scriptOutputValue: ScriptOutput): void =>
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(scriptOutputValue));
