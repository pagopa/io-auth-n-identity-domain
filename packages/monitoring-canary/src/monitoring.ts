// calculateNextPercentage.ts

import { Durations, LogsQueryClient, LogsQueryResultStatus, LogsTable } from '@azure/monitor-query';
import { DefaultAzureCredential } from '@azure/identity';
import * as winston from 'winston';

type IncrementOutput = {
  nextIncrementPercentage: number;
  afterMs: number;
}

type SwapOutput = {
  swap: boolean;
}

type ScriptOutput = IncrementOutput | SwapOutput;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
  ],
});

async function calculateNextStep(currentPercentage: number) {
  const azureLogAnalyticsWorkspaceId = process.env.APPLICATION_INSIGHTS_APP_ID;
  const logsQueryClient = new LogsQueryClient(new DefaultAzureCredential());

  if (!azureLogAnalyticsWorkspaceId) {
    logger.error("APPLICATION_INSIGHTS_APP_ID is not set.");
    process.exit(1);
  }

  const query = `
    requests
    | where timestamp > ago(5m)
    | summarize totalRequests = count(), failedRequests = countif(success == false)
  `;

  try {
    const result = await logsQueryClient.queryWorkspace(azureLogAnalyticsWorkspaceId, query, {
      duration: Durations.fiveMinutes,
    });
    if (result.status === LogsQueryResultStatus.Success) {
      const tablesFromResult: LogsTable[] = result.tables;
  
      if (tablesFromResult.length === 0) {
        logger.error(`No results for query '${query}'`);
        return;
      }
      const table = processTables(tablesFromResult);
      const totalRequests = table[0]["totalRequests"];
      const failedRequests = table[0]["failedRequests"];
      const failureRate = (failedRequests / totalRequests) * 100;
      logger.info(`Total Requests: ${totalRequests}`);
      logger.info(`Failed Requests: ${failedRequests}`);
      logger.info(`Failure Rate: ${failureRate}%`);

      const acceptableFailureRate = process.env.ACCEPTABLE_FAILURE_RATE ? parseFloat(process.env.ACCEPTABLE_FAILURE_RATE) : 1; // Default 1%
      const incrementStep = process.env.INCREMENT_STEP ? parseInt(process.env.INCREMENT_STEP, 10) : 10;
      const defaultAfterMs = process.env.DEFAULT_AFTER_MS ? parseInt(process.env.DEFAULT_AFTER_MS, 10) : 300000; // 5 minuti

      if (failureRate > acceptableFailureRate) {
        logger.error('Failure rate exceeds acceptable threshold.');
        process.exit(1);
      }

      const nextPercentage = currentPercentage + incrementStep;

      if (nextPercentage >= 100) {
        const output: SwapOutput = { swap: true };
        console.log(JSON.stringify(output));
      } else {
        const afterMs = defaultAfterMs;
        const output: IncrementOutput = { nextIncrementPercentage: nextPercentage, afterMs: afterMs };
        console.log(JSON.stringify(output));
      }

      process.exit(0);
    } else {
      logger.error('No data returned from Application Insights');
      process.exit(1);
    }
  } catch (err) {
    logger.error("Error executing the query");
    process.exit(1);
  }
}

function processTables(tablesFromResult: LogsTable[]): Record<string, any>[] {
  for (const table of tablesFromResult) {
    const columns = table.columnDescriptors
      .map((column) => column.name);
    return table.rows.map(row => row.reduce((prev: Record<string, any>, columnValue, index) => ({...prev, [`${columns[index]}`]: columnValue}), {} as Record<string, any>))
  }
  return [];
}

const currentPercentageArg = process.argv[2];
const currentPercentage = parseInt(currentPercentageArg, 10);

if (isNaN(currentPercentage) || currentPercentage < 0 || currentPercentage > 100) {
  logger.error('Invalid currentPercentage argument.');
  process.exit(1);
}

calculateNextStep(currentPercentage);
