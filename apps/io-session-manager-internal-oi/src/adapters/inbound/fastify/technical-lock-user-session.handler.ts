import {
  defineRoute,
  FiscalCodeSchema,
  ProblemJson,
} from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";
import z from "zod";

import type { TechnicalLockUserSessionUseCase } from "../../../application/use-cases/technical-lock-user-session.use-case.js";
import { BASE_PATH } from "../base-path.js";
import { TechnicalLockUserSessionOutputDto } from "../dtos/technical-lock-user-session.dto.js";

const technicalLockUserSessionContract = defineRoute({
  method: "post",
  path: `${BASE_PATH}/sessions/{fiscalCode}/lock`,
  request: { path: z.object({ fiscalCode: FiscalCodeSchema }) },
  response: {
    200: {
      description: "Lock created.",
      schema: TechnicalLockUserSessionOutputDto,
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

export const mountTechnicalLockUserSessionHandler = (
  server: FastifyInstance,
  useCase: TechnicalLockUserSessionUseCase,
): void => {
  mountFastifyRoute(server, {
    contract: technicalLockUserSessionContract,
    inputMapper: ({ path: { fiscalCode } }) => ({ fiscalCode }),
    outputMapper: () => ({ message: "ok" as const }),
    useCase,
  });
};
