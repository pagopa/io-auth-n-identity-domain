import {
  defineRoute,
  FiscalCodeSchema,
  ProblemJson,
} from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";
import z from "zod";

import type { ReleaseUserSessionLockUseCase } from "../../../application/use-cases/release-user-session-lock.use-case.js";
import { BASE_PATH } from "../base-path.js";
import { ReleaseUserSessionLockInputDto } from "../dtos/release-user-session-lock.dto.js";

const releaseUserSessionLockContract = defineRoute({
  method: "post",
  path: `${BASE_PATH}/auth/{fiscalCode}/release-lock`,
  request: {
    path: z.object({ fiscalCode: FiscalCodeSchema }),
    body: ReleaseUserSessionLockInputDto,
  },
  response: {
    204: { description: "Lock successfully released.", schema: z.void() },
    400: { description: "Bad request.", schema: ProblemJson },
    403: { description: "Operation forbidden.", schema: ProblemJson },
    500: { description: "There was an error.", schema: ProblemJson },
  },
});

export const mountReleaseUserSessionLockHandler = (
  server: FastifyInstance,
  useCase: ReleaseUserSessionLockUseCase,
): void => {
  mountFastifyRoute(server, {
    contract: releaseUserSessionLockContract,
    inputMapper: ({ path: { fiscalCode }, body: { unlock_code } }) => ({
      fiscalCode,
      unlockCode: unlock_code,
    }),
    outputMapper: () => undefined,
    useCase,
  });
};
