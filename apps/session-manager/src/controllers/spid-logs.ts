import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { QueueClient } from "@azure/storage-queue";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import {
  FiscalCode,
  IPString,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import { format } from "date-fns";
import * as O from "fp-ts/Option";
import { flow, pipe } from "fp-ts/lib/function";
import * as A from "fp-ts/lib/Array";
import * as S from "fp-ts/lib/string";
import * as R from "fp-ts/Reader";
import { DoneCallbackT } from "@pagopa/io-spid-commons";
import { SpidLogsRepo } from "../repositories";
import { LoginTypeEnum } from "../types/fast-login";
import { log } from "../utils/logger";
import { SAML_NAMESPACE } from "../types/spid";

const getRequestIDFromPayload =
  (tagName: string, attrName: string) =>
  (doc: Document): O.Option<string> =>
    pipe(
      O.fromNullable(
        doc.getElementsByTagNameNS(SAML_NAMESPACE.PROTOCOL, tagName).item(0),
      ),
      O.chain((element) =>
        O.fromEither(NonEmptyString.decode(element.getAttribute(attrName))),
      ),
    );

const getRequestIDFromResponse = getRequestIDFromPayload(
  "Response",
  "InResponseTo",
);

const getUserAttributeFromAssertion =
  (attrName: string) =>
  (SAMLResponse: Document): O.Option<NonEmptyString> =>
    pipe(
      Array.from(
        SAMLResponse.getElementsByTagNameNS(
          SAML_NAMESPACE.ASSERTION,
          "Attribute",
        ),
      ),
      A.findFirst((element) => element.getAttribute("Name") === attrName),
      O.chainNullableK((element) => element.textContent?.trim()),
      O.chain((value) => O.fromEither(NonEmptyString.decode(value))),
    );

const getFiscalNumberFromPayload: (doc: Document) => O.Option<FiscalCode> =
  flow(
    getUserAttributeFromAssertion("fiscalNumber"),
    O.map(S.toUpperCase),
    O.map((fiscalCode) =>
      // Remove the international prefix from fiscal code.
      fiscalCode.replace("TINIT-", ""),
    ),
    O.chain((nationalFiscalCode) =>
      O.fromEither(FiscalCode.decode(nationalFiscalCode)),
    ),
  );

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
export const makeSpidLogCallback: R.Reader<SpidLogDeps, DoneCallbackT<never>> =
  (deps) =>
  (
    sourceIp: string | null,
    requestPayload: string,
    responsePayload: string,
  ): void => {
    const logPrefix = `SpidLogCallback`;
    pipe(
      TE.tryCatch(async () => {
        const responseXML = new DOMParser().parseFromString(
          responsePayload,
          "text/xml",
        );
        if (!responseXML) {
          throw new Error("Cannot parse SPID XML");
        }

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
          loginType: deps.getLoginType(fiscalCode),
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
      TE.chain((spidLogMessage) =>
        SpidLogsRepo.sendSpidLogsMessage({ ...deps, spidLogMessage }),
      ),
      TE.mapLeft((err) => {
        log.error(`${logPrefix}|ERROR:${err.message}`);
      }),
    )().catch((error) => log.error(`${logPrefix}|ERROR:${error}`));
  };
