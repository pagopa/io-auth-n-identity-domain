import { afterEach, describe, expect, test } from "vitest";
import nodeFetch from "node-fetch";
import * as E from "fp-ts/Either";
import { createClient } from "../generated/session-mananger/client";
import { promisifyProcess, runProcess } from "../utils/process";

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
      await new Promise((ok) => setTimeout(ok, 3000));
    });

    // test(
    //   "Should return success if only one redis instance is not available",
    //   { timeout: 30000 },
    //   async () => {
    //     await promisifyProcess(
    //       runProcess(
    //         `docker compose --file ../../docker-compose.yml down redis-cluster`,
    //       ),
    //     );
    //     await new Promise((ok) => setTimeout(ok, 5000));
    //     const response = await client.healthcheck({});
    //     expect(response).toEqual(
    //       E.right(
    //         expect.objectContaining({
    //           status: 200,
    //         }),
    //       ),
    //     );
    //   },
    // );

    test(
      "Should return an error if the cluster state is not ok",
      { timeout: 30000 },
      async () => {
        await promisifyProcess(
          runProcess(
            `docker compose --file ../../docker-compose.yml down redis-cluster redis-node-0 redis-node-1 redis-node-2 redis-node-3 redis-node-4 redis-node-5`,
          ),
        );
        await new Promise((ok) => setTimeout(ok, 5000));

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
        await new Promise((ok) => setTimeout(ok, 10000));

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
