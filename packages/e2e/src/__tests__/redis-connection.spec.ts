import { afterEach, describe, expect, test } from "vitest";
import nodeFetch from "node-fetch";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { createClient } from "../generated/session-mananger/client";
import { promisifyProcess, runCommand, runProcess } from "../utils/process";
import { awaiter } from "../utils/awaiter";

const REDIS_CLUSTER_HEALTHY_CMD = `docker ps --filter name=redis-cluster --filter health=healthy --format "{{.ID}}: {{.Names}} {{.State}}"`;
const REDIS_CLUSTER_CMD = `docker ps --filter name=redis-cluster --format "{{.ID}}: {{.Names}} {{.State}}"`;
const ALL_CONTAINER_RUNNING_CMD = `docker ps --filter name=redis- --filter status=running --format "{{.ID}}: {{.Names}} {{.State}}"`;

const waitContainerChecks = async (
  command: string,
  expectedCount: number,
  timeout: number = 25000,
) => {
  const containerCountTask = pipe(
    TE.tryCatch(() => runCommand(command), E.toError),
    TE.map((_) => {
      // eslint-disable-next-line no-console
      console.debug(`COMMAND OUTPUT [${command}]: `, _);
      return _?.split("\n").filter((value) => value !== "").length;
    }),
    TE.getOrElseW(() => T.of(-1)),
  );
  await awaiter(containerCountTask, expectedCount, {
    interval: 500,
    timeout,
  });
};

describe("Redis Cluster Connection", () => {
  const client = createClient({
    baseUrl: "http://localhost:8081",
    basePath: "",
    fetchApi: nodeFetch as unknown as typeof fetch,
  });
  test("Should connect with a redis cluster and the healthcheck return success", async () => {
    const response = await client.healthcheck({});
    expect(response).toEqual(
      E.right(
        expect.objectContaining({
          status: 200,
          value: { version: expect.any(String) },
        }),
      ),
    );
  });

  describe("Failure scenarios", () => {
    afterEach(async () => {
      await promisifyProcess(
        runProcess(
          `docker compose --file ../../docker-compose.yml up redis-cluster -d`,
        ),
      );
      await waitContainerChecks(REDIS_CLUSTER_HEALTHY_CMD, 1, 3000);
    });

    // Test disabled becouse not working into the pipeline for a network
    // issue calling the other cluster node from the session-manager.
    test.skip(
      "Should return success if only one redis instance is not available",
      { timeout: 60000 },
      async () => {
        await promisifyProcess(
          runProcess(
            `docker compose --file ../../docker-compose.yml down redis-cluster`,
          ),
        );
        await waitContainerChecks(REDIS_CLUSTER_CMD, 0);
        const response = await client.healthcheck({});
        expect(response).toEqual(
          E.right(
            expect.objectContaining({
              status: 200,
            }),
          ),
        );
      },
    );

    test(
      "Should return an error if the cluster state is not ok and reconnect when comes up again",
      { timeout: 60000 },
      async () => {
        await promisifyProcess(
          runProcess(
            `docker compose --file ../../docker-compose.yml down redis-cluster redis-node-0 redis-node-1 redis-node-2 redis-node-3 redis-node-4 redis-node-5`,
          ),
        );
        await waitContainerChecks(ALL_CONTAINER_RUNNING_CMD, 1);

        const response = await client.healthcheck({});
        expect(response).toEqual(
          E.right(
            expect.objectContaining({
              status: 500,
            }),
          ),
        );
        await promisifyProcess(
          runProcess(
            `docker compose --file ../../docker-compose.yml up redis-cluster -d`,
          ),
        );
        await waitContainerChecks(REDIS_CLUSTER_HEALTHY_CMD, 1);
        await new Promise((resolve) => setTimeout(() => resolve(""), 2000));

        const afterReconnect = await client.healthcheck({});
        expect(afterReconnect).toEqual(
          E.right(
            expect.objectContaining({
              status: 200,
            }),
          ),
        );
      },
    );
  });
});
