import { sendMail } from "@pagopa/io-functions-commons/dist/src/mailer";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { htmlToText } from "html-to-text";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";
import * as L from "@pagopa/logger";

import * as mailTemplate from "@pagopa/io-app-email-templates/LoginNotificationIOWeb/index";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { UserSessionInfo } from "../generated/definitions/backend-session/UserSessionInfo";
import { EmailAddress } from "../generated/definitions/function-profile/EmailAddress";
import { ExtendedProfile } from "../generated/definitions/function-profile/ExtendedProfile";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { BackendInternalClientDependency } from "../utils/backend-internal-client/dependency";
import {
  EmailParameters,
  MailBody,
  MailerTransporterDependency
} from "../utils/email-utils";
import { FunctionProfileClientDependency } from "../utils/function-profile-client/dependency";
import { QueuePermanentError, QueueTransientError } from "../utils/queue-utils";

export const retrieveSession: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  BackendInternalClientDependency,
  QueueTransientError,
  UserSessionInfo
> = (fiscalCode: FiscalCode) => ({ backendInternalClient }) =>
  pipe(
    TE.tryCatch(
      () => backendInternalClient.getSession({ fiscalcode: fiscalCode }),
      () =>
        new QueueTransientError(
          "Error while calling the downstream component [retrieveSession]"
        )
    ),
    TE.chainEitherK(
      E.mapLeft(
        _ =>
          new QueueTransientError(
            "Unexpected response from backend internal [retrieveSession]"
          )
      )
    ),
    TE.chain(({ status, value }) =>
      status === 200
        ? TE.right(value)
        : TE.left(
            new QueueTransientError(
              `Error while retrieving user session: downstream component returned ${status} [retrieveSession]`
            )
          )
    )
  );

export const retrieveProfile: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  FunctionProfileClientDependency,
  QueueTransientError,
  ExtendedProfile
> = (fiscalCode: FiscalCode) => ({ functionProfileClient }) =>
  pipe(
    TE.tryCatch(
      () => functionProfileClient.getProfile({ fiscal_code: fiscalCode }),
      () =>
        new QueueTransientError(
          "Error while calling the downstream component [retrieveProfile]"
        )
    ),
    TE.chainEitherK(
      E.mapLeft(
        _ =>
          new QueueTransientError(
            "Unexpected response from function profile [retrieveProfile]"
          )
      )
    ),
    TE.chain(({ status, value }) =>
      status === 200
        ? TE.right(value)
        : TE.left(
            new QueueTransientError(
              `Error while retrieving user profile: downstream component returned ${status} [retrieveProfile]`
            )
          )
    )
  );

export const buildMailBody = (
  expiredSessionEmailParameters: EmailParameters
): E.Either<Error, MailBody> =>
  pipe(
    mailTemplate.apply(
      "TODO: replace with the real template" as NonEmptyString,
      "TODO: replace with the real template" as NonEmptyString,
      new Date(),
      "TODO: replace with the real template" as NonEmptyString,
      "TODO: replace with the real template" as NonEmptyString
    ),
    E.of,
    E.bindTo("emailHtml"),
    E.bind("emailText", ({ emailHtml }) =>
      E.tryCatch(
        () =>
          htmlToText(
            emailHtml,
            expiredSessionEmailParameters.htmlToTextOptions
          ),
        () => new Error("Error while converting html to text")
      )
    )
  );

export const notifySessionExpiration: (
  email: EmailAddress,
  expiredSessionEmailParameters: EmailParameters
) => RTE.ReaderTaskEither<
  MailerTransporterDependency & { logger: L.Logger },
  QueueTransientError,
  undefined
> = (email: EmailAddress, expiredSessionEmailParameters: EmailParameters) => ({
  mailerTransporter,
  logger
}) =>
  pipe(
    buildMailBody(expiredSessionEmailParameters),
    TE.fromEither,
    TE.chainW(({ emailHtml, emailText }) =>
      pipe(
        sendMail(mailerTransporter, {
          from: expiredSessionEmailParameters.from,
          html: emailHtml,
          subject: expiredSessionEmailParameters.title,
          text: emailText,
          to: email
        })
      )
    ),
    TE.orElseW(error =>
      pipe(
        L.errorRTE(
          `Error while sending email to the user => ${error.message} stack: ${error.stack}`
        )({ logger }),
        TE.chainW(_ =>
          TE.left(
            new QueueTransientError(
              `Error while sending email to the user [notifySessionExpiration] => ${error.message}`
            )
          )
        )
      )
    ),
    TE.map(_ => void 0)
  );

export const ExpiredSessionAdvisorHandler: (
  expiredSessionEmailParameters: EmailParameters
) => H.Handler<
  ExpiredSessionAdvisorQueueMessage,
  undefined,
  BackendInternalClientDependency &
    FunctionProfileClientDependency &
    MailerTransporterDependency
> = (expiredSessionEmailParameters: EmailParameters) =>
  H.of(({ fiscalCode }: ExpiredSessionAdvisorQueueMessage) =>
    pipe(
      retrieveSession(fiscalCode),
      RTE.filterOrElseW(
        userSessionInfo => !userSessionInfo.active,
        () => new Error("User has an active session")
      ),
      RTE.chainW(() => retrieveProfile(fiscalCode)),
      RTE.chainW(profileResponse =>
        pipe(
          profileResponse.email,
          O.fromNullable,
          O.fold(
            () => RTE.left(new QueuePermanentError("User has no email")),
            email =>
              notifySessionExpiration(email, expiredSessionEmailParameters)
          )
        )
      ),
      RTE.orElseW(error =>
        error instanceof QueuePermanentError
          ? RTE.right(void 0)
          : RTE.left(error)
      )
    )
  );

export const ExpiredSessionAdvisorFunction = (
  expiredSessionEmailParameters: EmailParameters
) => azureFunction(ExpiredSessionAdvisorHandler(expiredSessionEmailParameters));
