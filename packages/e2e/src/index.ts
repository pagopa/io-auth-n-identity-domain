import { resolve as resolvePath } from "path";
import nodeFetch from "node-fetch";
import { flow, pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { ProcessResult, promisifyProcess, runProcess } from "./utils/process";
import { createClient } from "./generated/session-mananger/client";
import { awaiter } from "./utils/awaiter";

const PROJECT_BASE_PATH = resolvePath(`${process.cwd()}/../../`);

const main = async () => {
  const results: ProcessResult[] = [];

  // eslint-disable-next-line functional/immutable-data
  // results.push(
  //   await promisifyProcess(
  //     runProcess(
  //       `docker compose --file ${PROJECT_BASE_PATH}/docker-compose.yml build cosmosdb io-profile io-lollipop`,
  //     ),
  //   ),
  // );

  // eslint-disable-next-line functional/immutable-data
  results.push(
    await promisifyProcess(
      runProcess(
        `docker compose --file ${PROJECT_BASE_PATH}/docker-compose.yml --env-file ${PROJECT_BASE_PATH}/docker/.env.common up redis-cluster -d`,
      ),
    ),
  );

  await new Promise((ok) => setTimeout(ok, 20000));

  // eslint-disable-next-line functional/immutable-data
  results.push(
    await promisifyProcess(
      runProcess(
        `docker compose --file ${PROJECT_BASE_PATH}/docker-compose.yml --env-file ${PROJECT_BASE_PATH}/docker/.env.common up io-session-manager -d`,
      ),
    ),
  );

  const client = createClient({
    baseUrl: "http://localhost:8081",
    basePath: "",
    fetchApi: nodeFetch as unknown as typeof fetch,
  });

  const healthcheckTask = pipe(
    TE.tryCatch(() => client.healthcheck({}), E.toError),
    TE.chainEitherK(flow(E.mapLeft(E.toError))),
    TE.map((response) => ({
      status: response.status,
    })),
    TE.getOrElseW((_) =>
      T.of({
        status: 0,
      }),
    ),
  );

  // eslint-disable-next-line functional/immutable-data
  const awaiterResult = await awaiter(
    healthcheckTask,
    { status: 200 },
    {
      interval: 500,
      timeout: 300000,
    },
  );

  if (awaiterResult === "ko") {
    throw new Error(
      "The session manager doesn't become healty within the timeout.",
    );
  }
  // eslint-disable-next-line functional/immutable-data
  results.push(await promisifyProcess(runProcess(`yarn test:e2e`)));

  // eslint-disable-next-line functional/immutable-data
  results.push(
    await promisifyProcess(
      runProcess(
        `docker compose --file ${PROJECT_BASE_PATH}/docker-compose.yml --env-file ${PROJECT_BASE_PATH}/docker/.env.common down`,
      ),
    ),
  );

  results.forEach((result) => {
    if (result === "ok") return;
    else throw new Error("at least one test scenario failed");
  });
};

main()
  .then((_) => {
    // eslint-disable-next-line no-console
    console.log("All test completed");
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
