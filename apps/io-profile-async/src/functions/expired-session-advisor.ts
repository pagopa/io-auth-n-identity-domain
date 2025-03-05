import { sendMail } from "@pagopa/io-functions-commons/dist/src/mailer";
import * as E from "fp-ts/lib/Either";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { htmlToText, HtmlToTextOptions } from "html-to-text";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";
import * as L from "@pagopa/logger";

import * as mailTemplate from "@pagopa/io-app-email-templates/ExpiredSessionUserReEngagement/index";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import { UserSessionInfo } from "../generated/definitions/backend-session/UserSessionInfo";
import { EmailAddress } from "../generated/definitions/function-profile/EmailAddress";
import { ExtendedProfile } from "../generated/definitions/function-profile/ExtendedProfile";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { trackEvent } from "../utils/appinsights";
import { BackendInternalClientDependency } from "../utils/backend-internal-client/dependency";
import { FunctionProfileClientDependency } from "../utils/function-profile-client/dependency";
import { MailerTransporterDependency } from "../utils/mailer-transporter/dependency";
import { QueuePermanentError, QueueTransientError } from "../utils/queue-utils";

export interface ExpiredSessionEmailParameters {
  readonly from: NonEmptyString;
  readonly htmlToTextOptions: HtmlToTextOptions;
  readonly title: NonEmptyString;
  readonly ctaUrl: ValidUrl;
}

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
  expiredSessionEmailParameters: ExpiredSessionEmailParameters,
  expiredAt: Date
): E.Either<Error, { emailHtml: string; emailText: string }> =>
  pipe(
    mailTemplate.apply(expiredSessionEmailParameters.ctaUrl, expiredAt),
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
  expiredSessionEmailParameters: ExpiredSessionEmailParameters,
  expiredAt: Date
) => RTE.ReaderTaskEither<
  MailerTransporterDependency & { logger: L.Logger },
  QueueTransientError,
  undefined
> = (
  email: EmailAddress,
  expiredSessionEmailParameters: ExpiredSessionEmailParameters,
  expiredAt: Date
) => ({ mailerTransporter, logger }) =>
  pipe(
    buildMailBody(expiredSessionEmailParameters, expiredAt),
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

export type ExpiredSessionAdvisorFunctionInput = {
  expiredSessionEmailParameters: ExpiredSessionEmailParameters;
  dryRunFeatureFlag: boolean;
};

export const ExpiredSessionAdvisorHandler: (
  expiredSessionAdvisorFunctionInput: ExpiredSessionAdvisorFunctionInput
) => H.Handler<
  ExpiredSessionAdvisorQueueMessage,
  undefined,
  BackendInternalClientDependency &
    FunctionProfileClientDependency &
    MailerTransporterDependency
> = ({ expiredSessionEmailParameters, dryRunFeatureFlag }) =>
  H.of(({ fiscalCode, expiredAt }) =>
    pipe(
      retrieveSession(fiscalCode),
      RTE.filterOrElseW(
        userSessionInfo => !userSessionInfo.active,
        () => new QueuePermanentError("User has an active session")
      ),
      RTE.chainW(() => retrieveProfile(fiscalCode)),
      RTE.filterOrElseW(
        profile => profile.is_email_validated,
        () => new QueuePermanentError("User email is not validated")
      ),
      RTE.map(profile => profile.email),
      RTE.chainW(
        RTE.fromNullable(new QueuePermanentError("User has no email"))
      ),
      RTE.chainW(email => {
        if (dryRunFeatureFlag) {
          trackEvent({
            name:
              "io.citizen-auth.prof-async.notify-session-expiration.dry-run",
            properties: {
              expiredAt
            },
            tagOverrides: {
              samplingEnabled: "false"
            }
          });
          return RTE.right(void 0);
        } else {
          return notifySessionExpiration(
            email,
            expiredSessionEmailParameters,
            expiredAt
          );
        }
      }),
      RTE.orElseW(error => {
        if (error instanceof QueuePermanentError) {
          trackEvent({
            name: "io.citizen-auth.prof-async.error.permanent",
            properties: {
              message: error.message
            },
            tagOverrides: {
              samplingEnabled: "false"
            }
          });
          return RTE.right(void 0);
        } else {
          return RTE.left(error);
        }
      })
    )
  );

export const ExpiredSessionAdvisorFunction = (
  expiredSessionAdvisorFunctionInput: ExpiredSessionAdvisorFunctionInput
) =>
  azureFunction(
    ExpiredSessionAdvisorHandler(expiredSessionAdvisorFunctionInput)
  );
