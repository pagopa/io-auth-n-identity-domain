/* eslint-disable no-underscore-dangle */
import { pipe, flow } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as A from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as H from "@pagopa/handler-kit";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { azureFunction } from "@pagopa/handler-kit-azure-func";
import { Semigroup } from "fp-ts/lib/Semigroup";
import {
  OnProfileUpdateFunctionInput,
  OnProfileUpdateDocument
} from "../types/on-profile-update-input-document";
import {
  ProfileEmailRepository,
  ProfileEmailRepositoryDependencies,
  ProfileRepository,
  ProfileRepositoryDependencies,
  TrackerRepositoryDependencies
} from "../repositories";

type FunctionDependencies = ProfileEmailRepositoryDependencies &
  TrackerRepositoryDependencies &
  ProfileRepositoryDependencies;

const eventNamePrefix = "OnProfileUpdate";

const errorSemigroup: Semigroup<Error> = {
  concat: (a: Error, b: Error) =>
    Error(`Error:${a.message};\nError:${b.message};\n`)
};

const getPreviousProfile = (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => (
  deps: FunctionDependencies
): TE.TaskEither<Error, O.Option<OnProfileUpdateDocument>> =>
  pipe(
    version - 1,
    NonNegativeInteger.decode,
    E.fold(
      () => TE.right(O.none),
      previousVersion =>
        ProfileRepository.onProfileUpdateFindDocument(
          fiscalCode,
          previousVersion
        )(deps)
    )
  );

const updateEmail: (
  profile: Required<
    Pick<OnProfileUpdateDocument, "isEmailValidated" | "email" | "fiscalCode">
  >,
  previousProfile: Required<
    Pick<OnProfileUpdateDocument, "isEmailValidated" | "email" | "fiscalCode">
  >
) => RTE.ReaderTaskEither<FunctionDependencies, Error, void> = (
  profile,
  previousProfile
) =>
  profile.isEmailValidated
    ? previousProfile.isEmailValidated
      ? RTE.right(void 0)
      : ProfileEmailRepository.emailInsert({
          email: profile.email,
          fiscalCode: profile.fiscalCode
        })
    : previousProfile.isEmailValidated
    ? ProfileEmailRepository.emailDelete({
        email: previousProfile.email,
        fiscalCode: profile.fiscalCode
      })
    : RTE.right(void 0);

const handlePresentEmail = (
  previousProfile: OnProfileUpdateDocument,
  profile: Required<OnProfileUpdateDocument>
): RTE.ReaderTaskEither<FunctionDependencies, Error, void> =>
  pipe(
    O.fromNullable(previousProfile.email),
    O.fold(
      () =>
        profile.isEmailValidated
          ? ProfileEmailRepository.emailInsert({
              email: profile.email,
              fiscalCode: profile.fiscalCode
            })
          : RTE.right(void 0),
      previousEmail =>
        updateEmail(
          {
            email: profile.email,
            fiscalCode: profile.fiscalCode,
            isEmailValidated: profile.isEmailValidated
          },
          {
            email: previousEmail,
            fiscalCode: previousProfile.fiscalCode,
            isEmailValidated: previousProfile.isEmailValidated
          }
        )
    )
  );

const handleMissingEmail = (
  previousProfile: OnProfileUpdateDocument,
  profile: Omit<OnProfileUpdateDocument, "email">
) => (dependencies: FunctionDependencies): TE.TaskEither<Error, void> =>
  pipe(
    O.fromNullable(previousProfile.email),
    O.fold(
      () => TE.right(void 0),
      previousEmail => {
        dependencies.telemetryClient?.trackEvent({
          name: `${eventNamePrefix}.missingNewEmail`,
          properties: {
            _self: profile._self,
            fiscalCode: hashFiscalCode(profile.fiscalCode),
            isEmailValidated: profile.isEmailValidated,
            isPreviousEmailValidated: previousProfile.isEmailValidated
          },
          tagOverrides: { samplingEnabled: "false" }
        });
        return previousProfile.isEmailValidated
          ? pipe(
              dependencies,
              ProfileEmailRepository.emailDelete({
                email: previousEmail,
                fiscalCode: profile.fiscalCode
              })
            )
          : TE.right(void 0);
      }
    )
  );

/*
If the current email is validated but the previous email was not validated => it inserts the new email into profileEmails
If the current email is not validated but the previous email was validated => it deletes the previous email from profileEmails
*/
const handlePositiveVersion = ({
  email,
  fiscalCode,
  isEmailValidated,
  version,
  _self
}: OnProfileUpdateDocument): RTE.ReaderTaskEither<
  FunctionDependencies,
  Error,
  void
> =>
  pipe(
    getPreviousProfile(fiscalCode, version),
    RTE.chain(
      flow(
        O.fold(
          () =>
            pipe(
              RTE.asks(({ telemetryClient }: FunctionDependencies) =>
                telemetryClient?.trackEvent({
                  name: `${eventNamePrefix}.previousProfileNotFound`,
                  properties: {
                    _self,
                    fiscalCode: hashFiscalCode(fiscalCode)
                  },
                  tagOverrides: { samplingEnabled: "false" }
                })
              ),
              RTE.map(() => void 0)
            ),
          previousProfile =>
            email
              ? handlePresentEmail(previousProfile, {
                  _self,
                  email,
                  fiscalCode,
                  isEmailValidated,
                  version
                })
              : handleMissingEmail(previousProfile, {
                  _self,
                  fiscalCode,
                  isEmailValidated,
                  version
                })
        )
      )
    )
  );

const handleProfile = (
  profile: OnProfileUpdateDocument
): RTE.ReaderTaskEither<FunctionDependencies, Error, void> =>
  profile.version === 0
    ? profile.email && profile.isEmailValidated
      ? ProfileEmailRepository.emailInsert({
          email: profile.email,
          fiscalCode: profile.fiscalCode
        })
      : RTE.right<FunctionDependencies, Error, void>(void 0)
    : handlePositiveVersion(profile);

export const handler: (
  documents: OnProfileUpdateFunctionInput
) => RTE.ReaderTaskEither<
  FunctionDependencies,
  Error,
  undefined
> = documents => dependencies =>
  pipe(
    documents,
    A.map(document =>
      pipe(
        document,
        OnProfileUpdateDocument.decode,
        E.fold(
          () => {
            dependencies.telemetryClient?.trackEvent({
              name: `${eventNamePrefix}.decodingProfile`,
              properties: {
                _self:
                  typeof document === "object" &&
                  document !== null &&
                  "_self" in document
                    ? document._self
                    : "unknown-id"
              },
              tagOverrides: { samplingEnabled: "false" }
            });
            return TE.right(void 0);
          },
          profileDocument =>
            pipe(
              dependencies,
              handleProfile(profileDocument),
              TE.mapLeft(error => {
                dependencies.telemetryClient?.trackEvent({
                  name: `${eventNamePrefix}.handlingProfile`,
                  properties: {
                    _self: profileDocument._self,
                    error,
                    fiscalCode: hashFiscalCode(profileDocument.fiscalCode)
                  },
                  tagOverrides: { samplingEnabled: "false" }
                });
                return error;
              })
            )
        )
      )
    ),
    A.sequence(
      TE.getApplicativeTaskValidation(T.ApplicativeSeq, errorSemigroup)
    ),
    TE.map(_ => void 0)
  );

export const OnProfileUpdateFunctionHandler: H.Handler<
  OnProfileUpdateFunctionInput,
  undefined,
  FunctionDependencies
> = H.of(handler);

export const OnProfileUpdateFunction = azureFunction(
  OnProfileUpdateFunctionHandler
);
