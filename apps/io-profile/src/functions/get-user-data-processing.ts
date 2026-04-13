import { InvocationContext } from "@azure/functions";

import {
  IResponseErrorQuery,
  ResponseErrorQuery,
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";

import { UserDataProcessing as UserDataProcessingApi } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessing";
import { UserDataProcessingChoice } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import {
  makeUserDataProcessingId,
  UserDataProcessingModel,
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";


import { isLeft } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import {
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { toUserDataProcessingApi } from "../utils/user-data-processings";

/**
 * Type of a GetUserDataProcessing handler.
 */
type IGetUserDataProcessingHandler = (
  context: InvocationContext,
  fiscalCode: FiscalCode,
  userDataProcessingChoice: UserDataProcessingChoice,
) => Promise<
  | IResponseSuccessJson<UserDataProcessingApi>
  | IResponseErrorQuery
  | IResponseErrorNotFound
>;

export function GetUserDataProcessingHandler(
  userDataProcessingModel: UserDataProcessingModel,
): IGetUserDataProcessingHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, choice) => {
    const logPrefix = `GetUserDataProcessingHandler|FISCAL_CODE=${fiscalCode}`;
    const id = makeUserDataProcessingId(choice, fiscalCode);
    const maybeResultOrError =
      await userDataProcessingModel.findLastVersionByModelId([
        id,
        fiscalCode,
      ])();
    if (isLeft(maybeResultOrError)) {
      const failure = maybeResultOrError.left;

      context.error(`${logPrefix}|ERROR=${failure.kind}`);
      if (
        failure.kind === "COSMOS_ERROR_RESPONSE" &&
        failure.error.code === 404
      ) {
        return ResponseErrorNotFound(
          "Not Found while retrieving User Data Processing",
          `${failure.error.message}`,
        );
      } else {
        return ResponseErrorQuery(
          "Error while retrieving a user data processing",
          failure,
        );
      }
    }

    const maybeUserDataProcessing = maybeResultOrError.right;
    if (isSome(maybeUserDataProcessing)) {
      const userDataProc = maybeUserDataProcessing.value;
      return ResponseSuccessJson(toUserDataProcessingApi(userDataProc));
    } else {
      return ResponseErrorNotFound(
        "Error while retrieving user data processing",
        "Not Found",
      );
    }
  };
}

export function GetUserDataProcessing(userDataProcessingModel: UserDataProcessingModel) {
  const handler = GetUserDataProcessingHandler(userDataProcessingModel);
  const middlewares = [
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("choice", UserDataProcessingChoice),
  ] as const;
  return wrapHandlerV4(middlewares, handler);
}
