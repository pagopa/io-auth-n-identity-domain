import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { makeReserveUseCase } from "../../../application/use-cases/reserve.use-case.js";
import { BASE_PATH } from "../base-path.js";
import {
  ReserveInputDTO,
  ReserveOutputDTO,
} from "../dtos/reserve-pub-key.dto.js";

const reserveContract = defineRoute({
  method: "post",
  operationId: "reserve",
  path: `${BASE_PATH}/reserve`,
  request: ReserveInputDTO,
  summary: "Reserve an OIDC authorization request",
  description:
    "Prepares (reserves) an OpenID Connect authorization request for the Lollipop-bound client and returns the parameters needed to start the login flow with the selected OneIdentity environment.",
  tags: ["oidc"],
  // Public endpoint: bootstraps the OIDC login flow.
  security: [],
  response: {
    200: {
      description: "Lollipop Key has been reserved successfully",
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
});

export const mountReserveHandler = (
  server: FastifyInstance,
  useCase: ReturnType<typeof makeReserveUseCase>,
): void => {
  mountFastifyRoute(server, {
    contract: reserveContract,
    inputMapper: (req) => ({
      lollipopHashAlgorithm: req.body.lollipop_hash_algo,
      lollipopPublicKey: req.body.lollipop_pub_key,
      loginType: req.body.login_type,
      currentUser: req.body.current_user,
      oidcConfigurationEnv: req.body.env,
      minAuthLevel: req.body.min_auth_level,
    }),
    useCase,
  });
};

// Widened for the OpenAPI generator: exporting the inferred contract type would
// leak the branded `unique symbol` of `ReserveOutputDTO` (TS2527).
export const reserveRoute: AnyRouteContract = reserveContract;
