import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { QueueClient } from "@azure/storage-queue";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, IPString } from "@pagopa/ts-commons/lib/strings";
import { format } from "date-fns";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import * as R from "fp-ts/Reader";
import { DoneCallbackT } from "@pagopa/io-spid-commons";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";
import { SpidLogsRepo } from "../repositories";
import { AdditionalLoginPropsT, LoginTypeEnum } from "../types/fast-login";
import { log } from "../utils/logger";
import {
  getFiscalNumberFromPayload,
  getRequestIDFromResponse,
} from "../utils/spid";

type SpidLogDeps = {
  spidLogQueueClient: QueueClient;
  getLoginType: (
    fiscalCode: FiscalCode,
    loginType?: LoginTypeEnum,
  ) => LoginTypeEnum;
};

/**
 * Generate the done callback used by `io-spid-commons` with the capability of generate and send
 * a message inside a queue to store the Spid Logs.
 * @param deps the required dependencies with the queue client and the login type selector
 * @returns The done callback used by the `io-spid-common` library
 */
export const makeSpidLogCallback: R.Reader<
  SpidLogDeps,
  DoneCallbackT<AdditionalLoginPropsT>
> =
  (deps) =>
  (
    sourceIp: string | null,
    requestPayload: string,
    responsePayload: string,
    additionalProps?: AdditionalLoginPropsT,
  ): void => {
    const logPrefix = `SpidLogCallback`;
    pipe(
      responsePayload,
      safeXMLParseFromString,
      TE.fromOption(() => new Error("Cannot parse SPID XML")),
      TE.chain((responseXML) =>
        TE.tryCatch(async () => {
          const maybeRequestId = getRequestIDFromResponse(responseXML);
          if (O.isNone(maybeRequestId)) {
            throw new Error("Cannot get Request ID from SPID XML");
          }
          const requestId = maybeRequestId.value;

          const maybeFiscalCode = getFiscalNumberFromPayload(responseXML);
          if (O.isNone(maybeFiscalCode)) {
            throw new Error("Cannot get user's fiscal Code from SPID XML");
          }
          const fiscalCode = maybeFiscalCode.value;

          const errorOrSpidMsg = SpidLogsRepo.SpidLogMessage.decode({
            createdAt: new Date(),
            createdAtDay: format(new Date(), "YYYY-MM-DD"),
            fiscalCode,
            ip: sourceIp as IPString,
            loginType: deps.getLoginType(
              fiscalCode,
              additionalProps?.loginType,
            ),
            requestPayload,
            responsePayload,
            spidRequestId: requestId,
          } as SpidLogsRepo.SpidLogMessage);

          if (E.isLeft(errorOrSpidMsg)) {
            log.debug(
              `${logPrefix}|ERROR_DETAILS=${readableReport(errorOrSpidMsg.left)}`,
            );
            throw new Error("Invalid format for SPID log payload");
          }
          return errorOrSpidMsg.right;
        }, E.toError),
      ),
      TE.chain((spidLogMessage) =>
        SpidLogsRepo.sendSpidLogsMessage({ ...deps, spidLogMessage }),
      ),
      TE.mapLeft((err) => {
        log.error(`${logPrefix}|ERROR:${err.message}`);
      }),
    )().catch((error) => log.error(`${logPrefix}|ERROR:${error}`));
  };
