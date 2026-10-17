import {
  defineRoute,
  NonEmptyStringBrand,
  ProblemJson,
} from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { makeGetUserIdentityUseCase } from "../../../application/use-cases/get-user-identity.use-case.js";
import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { BASE_PATH } from "../base-path.js";
import { GetUserIdentityOutputDTO } from "../dtos/get-user-identity.dto.js";

// This is a temporary workaround to ensure that the branded types are included in the type system.
const _brands = [NonEmptyStringBrand];

const getUserIdentityContract = defineRoute({
  operationId: "getUserIdentity",
  method: "get",
  path: `${BASE_PATH}/user-identity`,
  request: {},
  summary: "Session token introspection",
  description:
    "Introspect the session token and returns the related user identity",
  response: {
    200: {
      description: "Found.",
      schema: GetUserIdentityOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description: "Token null or expired.",
      schema: ProblemJson,
    },
    500: {
      description: "There was an error retrieving user's identity.",
      schema: ProblemJson,
    },
  },
  security: [{ bearerAuth: [] }],
});

type GetUserIdentityHandlerDeps = {
  middlewares: readonly [AuthenticationMiddleware<"session">];
  useCase: ReturnType<typeof makeGetUserIdentityUseCase>;
};

export const mountGetUserIdentityHandler =
  (deps: GetUserIdentityHandlerDeps) =>
  (server: FastifyInstance): void => {
    mountFastifyRoute(server, {
      contract: getUserIdentityContract,
      middlewares: deps.middlewares,
      inputMapper: (_, context) => ({ session: context.session }),
      outputMapper: (identity) => ({
        family_name: identity.familyName,
        fiscal_code: identity.fiscalCode,
        assertion_ref: identity.assertionRef,
        name: identity.name,
        date_of_birth: identity.dateOfBirth.toISOString().slice(0, 10),
        spid_email: identity.spidEmail,
        spid_level: identity.spidLevel,
        created_at: identity.createdAt.getTime(),
        token_remaining_ttl: identity.tokenRemainingTtl,
        session_tracking_id: identity.sessionId,
        // TODO: check if can be renamed into a simpler field name
        // since the IdP could be CIE which is not a SPID provider.
        spid_idp: "TODO",
      }),
      useCase: deps.useCase,
    });
  };

// Widened for the OpenAPI generator: exporting the inferred contract type would
// leak the branded `unique symbol` of the output DTO (TS2527).
export const getUserIdentityRoute: AnyRouteContract = getUserIdentityContract;
