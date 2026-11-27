import {
  defineRoute,
  FiscalCodeSchema,
  ProblemJson,
} from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";
import z from "zod";

import type { TechnicalUnlockUserSessionUseCase } from "../../../application/use-cases/technical-unlock-user-session.use-case.js";
import { BASE_PATH } from "../base-path.js";
import { TechnicalUnlockUserSessionOutputDto } from "../dtos/technical-unlock-user-session.dto.js";

const technicalUnlockUserSessionContract = defineRoute({
  method: "delete",
  path: `${BASE_PATH}/sessions/{fiscalCode}/lock`,
  request: { path: z.object({ fiscalCode: FiscalCodeSchema }) },
  response: {
    200: {
      description: "Lock removed.",
      schema: TechnicalUnlockUserSessionOutputDto,
    },
    400: {
      description: "Bad request.",
      schema: ProblemJson,
    },
    500: {
      description: "There was an error.",
      schema: ProblemJson,
    },
  },
});

export const mountTechnicalUnlockUserSessionHandler = (
  server: FastifyInstance,
  useCase: TechnicalUnlockUserSessionUseCase,
): void => {
  mountFastifyRoute(server, {
    contract: technicalUnlockUserSessionContract,
    inputMapper: ({ path: { fiscalCode } }) => ({ fiscalCode }),
    outputMapper: () => ({ message: "ok" as const }),
    useCase,
  });
};
