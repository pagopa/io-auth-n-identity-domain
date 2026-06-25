import { mountFastifyRoute } from "@pagopa/io-core-adapter-fastify";
import type { RouteRegistry } from "@pagopa/io-core-openapi";
import { defineRoute, ProblemJson } from "@pagopa/io-core-openapi";
import {
  LollipopPublicKeyHashingAlgorithmSchema,
  type LollipopPublicKey,
  type LollipopPublicKeyHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import {
  type ConflictError,
  type GenericError,
} from "@pagopa/io-core-domain/errors";
import type { FastifyInstance } from "fastify";

import type { reserveLollipopPubKeyUseCase } from "../../../application/use-cases/reserve-lollipop-pub-key.use-case.js";
import {
  ReservePubKeyHeadersSchema,
  ReservePubKeyOutputSchema,
} from "../dtos/reserve-pub-key.dto.js";

const reservePubKeyContract = defineRoute({
  description:
    "Reserves a lollipop public key for the current login attempt. Accepts the JWK public key via request headers and returns the generated assertion reference.",
  method: "post",
  operationId: "reservePubKey",
  path: "/api/lollipop/pubkeys",
  request: {
    headers: ReservePubKeyHeadersSchema,
  },
  response: {
    201: {
      description: "Public key reserved successfully.",
      schema: ReservePubKeyOutputSchema,
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
  registry?: RouteRegistry,
): void => {
  mountFastifyRoute(server, {
    contract: reservePubKeyContract,
    registry,
    transformInput: ({ headers }) => ({
      algorithm: headers["x-pagopa-lollipop-pub-key-hash-algo"],
      publicKey: headers["x-pagopa-lollipop-pub-key"],
    }),
    useCase,
  });
};
