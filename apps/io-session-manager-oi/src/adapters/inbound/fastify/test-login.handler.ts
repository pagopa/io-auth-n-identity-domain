import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import type { TestLoginUseCase } from "../../../application/use-cases/test-login.use-case.js";
import { BASE_PATH } from "../base-path.js";
import {
  TestLoginInputDTO,
  TestLoginOutputDTO,
} from "../dtos/test-login.dto.js";

import { extractIpMiddleware } from "./middlewares/extract-ip.middleware.js";

const testLoginContract = defineRoute({
  method: "post",
  operationId: "testLogin",
  path: `${BASE_PATH}/test-login`,
  request: TestLoginInputDTO,
  summary: " Login Test User with password",
  description: " Login Test User with password and Fiscal Code.",
  tags: ["test"],
  security: [],
  response: {
    200: {
      description: "Access token",
      schema: TestLoginOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description: "Invalid credentials",
      schema: ProblemJson,
    },
    409: {
      description: "Lollipop public key already reserved",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
});

type TestLoginHandlerDeps = {
  useCase: TestLoginUseCase;
};

export const mountTestLoginHandler = (
  server: FastifyInstance,
  deps: TestLoginHandlerDeps,
): void => {
  mountFastifyRoute(server, {
    contract: testLoginContract,
    middlewares: [extractIpMiddleware] as const,
    inputMapper: (req, context) => ({
      lollipopHashAlgorithm: req.body.lollipop_hash_algo,
      lollipopPublicKey: req.body.lollipop_pub_key,
      loginType: req.body.login_type,
      username: req.body.username,
      password: req.body.password,
      ipAddress: context.ipAddress,
    }),
    outputMapper: (output) => ({
      access_token: output.accessToken,
    }),
    useCase: deps.useCase,
  });
};

// Widened for the OpenAPI generator: exporting the inferred contract type would
// leak the branded `unique symbol` of `TestLoginOutputDTO` (TS2527).
export const testLoginRoute: AnyRouteContract = testLoginContract;
