import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";

import type { reserveLollipopPubKeyUseCase } from "../../../application/use-cases/reserve-lollipop-pub-key.use-case.js";
import {
  LollipopReservePublicKeyHeadersSchema,
  LollipopReservePublicKeyResponseSchema,
} from "../dtos/reserve-pub-key.dto.js";

const reservePubKeyContract = defineRoute({
  description:
    "Reserves a lollipop public key for the current login attempt. Accepts the JWK public key via request headers and returns the generated assertion reference.",
  method: "post",
  operationId: "reservePubKey",
  path: "/api/lollipop/pubkeys",
  request: {
    headers: LollipopReservePublicKeyHeadersSchema,
  },
  response: {
    201: {
      description: "Public key reserved successfully.",
      schema: LollipopReservePublicKeyResponseSchema,
    },
    400: ProblemJson,
    409: ProblemJson,
    500: ProblemJson,
  },
  summary: "Reserve a lollipop public key",
  tags: ["Lollipop"],
});

export const mountReservePubKeyHandler = (
  server: FastifyInstance,
  useCase: ReturnType<typeof reserveLollipopPubKeyUseCase>,
): void => {
  mountFastifyRoute(server, {
    contract: reservePubKeyContract,
    inputMapper: (req) => ({
      algorithm: req.headers["x-pagopa-lollipop-pub-key-hash-algo"],
      publicKey: req.headers["x-pagopa-lollipop-pub-key"],
    }),
    useCase,
  });
};
