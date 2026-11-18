import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { BASE_PATH } from "../base-path.js";
import { VerifySessionExistanceOutputDTO } from "../dtos/verify-session-existance.dtos.js";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";










const verifySessionExistance = defineRoute({
  method: "post",
  operationId: "verifySessionExistance",
  path: `${BASE_PATH}/sessions/{fiscalCode}`,
  request: {},
  summary: "Verify the existance of a session",
  security: [],
  response: {
    200: {
      description: "Success response",
      schema: VerifySessionExistanceOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    500: {
      description: "Server error",
      schema: ProblemJson,
    },
  },
});



export const mountVerifySessionExistanceHandler =
  (deps: GetSessionHandlerDeps) =>
  (server: FastifyInstance): void => {
    mountFastifyRoute(server, {
      contract: getSessionContract,
      middlewares: deps.middlewares,
      inputMapper: (req, context) => ({
        sessionToken: context.sessionToken,
        session: context.session,
        fieldsFilter: req.query.fields,
      }),
      useCase: deps.useCase,
    });
  };