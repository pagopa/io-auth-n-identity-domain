import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { FastifyInstance } from "fastify";

import { makeReserveUseCase } from "../../../application/use-cases/reserve.use-case.js";
import {
  ReserveInputDTO,
  ReserveOutputDTO,
} from "../dtos/reserve-pub-key.dto.js";

const reserveContract = defineRoute({
  description: "Reserve a Lollipop PubKey",
  method: "get",
  operationId: "reserve",
  path: "/api/auth/v2/reserve",
  request: ReserveInputDTO,
  response: {
    200: {
      description: "Application info returned successfully.",
      schema: ReserveOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    409: {
      description: "Conflict",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
  summary: "Reserve Lollipop PubKey",
  tags: ["Lollipop"],
});

export const mountReserveHandler = (
  server: FastifyInstance,
  useCase: ReturnType<typeof makeReserveUseCase>,
): void => {
  mountFastifyRoute(server, {
    contract: reserveContract,
    inputMapper: (req) => ({
      lollipopHashAlgorithm: req.headers["x-pagopa-lollipop-hash-algorithm"],
      lollipopPublicKey: req.headers["x-pagopa-lollipop-pub-key"],
      loginType: req.headers["x-pagopa-login-type"],
      currentUser: req.headers["x-pagopa-current-user"],
      oidcConfigurationEnv: req.query.env,
      authLevel: req.query.authLevel,
    }),
    useCase,
  });
};
