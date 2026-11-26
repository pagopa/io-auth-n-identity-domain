import {
  defineRoute,
  FiscalCodeSchema,
  ProblemJson,
} from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";
import z from "zod";

import type { LockUserSessionUseCase } from "../../../application/use-cases/lock-user-session.use-case.js";
import { BASE_PATH } from "../base-path.js";
import { LockUserSessionInputDto } from "../dtos/lock-user-session.dto.js";

const lockUserSessionContract = defineRoute({
  method: "post",
  path: `${BASE_PATH}/auth/{fiscalCode}/lock`,
  request: {
    path: z.object({ fiscalCode: FiscalCodeSchema }),
    body: LockUserSessionInputDto,
  },
  response: {
    204: { description: "Lock created.", schema: z.void() },
    400: { description: "Bad request.", schema: ProblemJson },
    409: {
      description: "The user lock has been already created.",
      schema: ProblemJson,
    },
    500: { description: "There was an error.", schema: ProblemJson },
  },
});

export const mountLockUserSessionHandler = (
  server: FastifyInstance,
  useCase: LockUserSessionUseCase,
): void => {
  mountFastifyRoute(server, {
    contract: lockUserSessionContract,
    inputMapper: ({ path: { fiscalCode }, body: { unlock_code } }) => ({
      fiscalCode,
      unlockCode: unlock_code,
    }),
    outputMapper: () => undefined,
    useCase,
  });
};
