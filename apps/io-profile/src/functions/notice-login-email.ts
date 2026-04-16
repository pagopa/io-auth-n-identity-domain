import { InvocationContext } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import {
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  ResponseErrorInternal,
  ResponseSuccessAccepted,
} from "@pagopa/ts-commons/lib/responses";
import * as df from "durable-functions";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { createTracker } from "../utils/tracking";
import { startOrchestrator } from "../utils/durable";
import { UserLoginParams } from "../generated/definitions/internal/UserLoginParams";
import { OrchestratorInput } from "./notice-login-email-orchestrator";

/**
 * Type of the handler.
 */
type INoticeLoginEmailHandler = (
  context: InvocationContext,
  triggerPayload: UserLoginParams,
) => Promise<IResponseSuccessAccepted<undefined> | IResponseErrorInternal>;

export const NoticeLoginEmailHandler =
  (
    _telemetryClient?: ReturnType<typeof createTracker>,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  ): INoticeLoginEmailHandler =>
  async (context, triggerPayload) => {
    const dfClient = df.getClient(context);

    const orchestratorId = `${triggerPayload.fiscal_code}-NOTICE-LOGIN-EMAIL`;

    return pipe(
      startOrchestrator(
        dfClient,
        "NoticeLoginEmailOrchestrator",
        orchestratorId,
        { ...triggerPayload, date_time: new Date() },
        OrchestratorInput,
      ),
      TE.bimap(
        (error) =>
          ResponseErrorInternal(
            `Error while starting the orchestrator|ERROR=${error}`,
          ),
        (_) =>
          ResponseSuccessAccepted<undefined>(
            "Email send request has been accepted",
            undefined,
          ),
      ),
      TE.toUnion,
    )();
  };

export const NoticeLoginEmail = (
  telemetryClient?: ReturnType<typeof createTracker>,
) => {
  const handler = NoticeLoginEmailHandler(telemetryClient);
  const middlewares = [
    ContextMiddleware(),
    RequiredBodyPayloadMiddleware(UserLoginParams),
  ] as const;
  return wrapHandlerV4(middlewares, handler);
};
