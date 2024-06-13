import { Server } from "http";
import { afterAll, describe, expect, test, vi } from "vitest";
import express from "express";
import {
  mockQuit,
  mockRedisClientSelector,
  mockSelect,
} from "../__mocks__/redis.mocks";

vi.mock("../repositories/redis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../repositories/redis")>()),
  // this will only affect "foo" outside of the original module
  RedisClientSelector: () => async () => mockRedisClientSelector,
}));
vi.mock("http-graceful-shutdown");

import { serverStarter } from "../server";
import { newApp } from "../app";

const STOP_EVENT_NAME = "server:stop";

afterAll(() => {
  vi.restoreAllMocks();
});

const mockListen = vi
  .fn<
    Parameters<express.Application["listen"]>,
    ReturnType<express.Application["listen"]>
  >()
  .mockImplementation(() => ({}) as unknown as Server);

describe("Graceful Shutdown", async () => {
  test("should call quit method for each redis when the server stops", async () => {
    const appAndParams = await newApp({});
    await serverStarter(
      Promise.resolve({
        ...appAndParams,
        app: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(appAndParams.app as any),
          listen: mockListen,
        },
      }),
    );
    appAndParams.app.emit(STOP_EVENT_NAME);
    expect(mockQuit).toBeCalledTimes(mockSelect().length);
  });
});
