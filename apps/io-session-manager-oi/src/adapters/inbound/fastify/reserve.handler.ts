import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import {
  ReserveInputDTO,
  ReserveOutputDTO,
} from "../dtos/reserve-pub-key.dto.js";
import { FastifyInstance } from "fastify";
import { makeReserveUseCase } from "../../../application/use-cases/reserve.use-case.js";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { Config } from "../../../domain/value-objects/config.vo.js";

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
  config: Config,
): void => {
  mountFastifyRoute(server, {
    contract: reserveContract,
    inputMapper: (req) => ({
      lollipopHashAlgorithm: req.headers["x-pagopa-lollipop-hash-algorithm"],
      lollipopPublicKey: req.headers["x-pagopa-lollipop-pub-key"],
      loginType: req.headers["x-pagopa-login-type"],
      currentUser: req.headers["x-pagopa-current-user"],
      oidc: {
        configurationEnv: req.query.env,
        clientRedirectUri: new URL(config.ONEID_PROD_REDIRECT_URI),
        prodClientId: config.ONEID_PROD_CLIENT_ID,
        prodBaseUrl: new URL(config.ONEID_PROD_ISSUER),
        uatClientId: config.ONEID_UAT_CLIENT_ID,
        uatBaseUrl: config.ONEID_UAT_ISSUER
          ? new URL(config.ONEID_UAT_ISSUER)
          : undefined,
      },
      authLevel: req.query.authLevel,
    }),
    useCase,
  });
};
