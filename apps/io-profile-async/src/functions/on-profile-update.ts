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
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
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
  Tracker,
  TrackerRepositoryDependency
} from "../repositories";

type FunctionDependencies = {
  ProfileRepository: ProfileRepository;
  ProfileEmailRepository: ProfileEmailRepository;
  TrackerRepository: Tracker;
} & ProfileEmailRepositoryDependencies &
  TrackerRepositoryDependency &
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
        deps.ProfileRepository.onProfileUpdateFindDocument(
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
) => deps =>
  profile.isEmailValidated
    ? previousProfile.isEmailValidated
      ? TE.right(void 0)
      : deps.ProfileEmailRepository.emailInsert({
          email: profile.email,
          fiscalCode: profile.fiscalCode
        })(deps)
    : previousProfile.isEmailValidated
    ? deps.ProfileEmailRepository.emailDelete({
        email: previousProfile.email,
        fiscalCode: profile.fiscalCode
      })(deps)
    : TE.right(void 0);

const handlePresentEmail = (
  previousProfile: OnProfileUpdateDocument,
  profile: Required<OnProfileUpdateDocument>
): RTE.ReaderTaskEither<FunctionDependencies, Error, void> => deps =>
  pipe(
    O.fromNullable(previousProfile.email),
    O.fold(
      () =>
        profile.isEmailValidated
          ? deps.ProfileEmailRepository.emailInsert({
              email: profile.email,
              fiscalCode: profile.fiscalCode
            })(deps)
          : TE.right(void 0),
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
        )(deps)
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
        dependencies.TrackerRepository.trackEvent(
          `${eventNamePrefix}.missingNewEmail` as NonEmptyString,
          undefined,
          false,
          {
            _self: profile._self,
            fiscalCode: hashFiscalCode(profile.fiscalCode),
            isEmailValidated: profile.isEmailValidated,
            isPreviousEmailValidated: previousProfile.isEmailValidated
          }
        )(dependencies);
        return previousProfile.isEmailValidated
          ? pipe(
              dependencies,
              dependencies.ProfileEmailRepository.emailDelete({
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
              RTE.asks(({ TrackerRepository }: FunctionDependencies) =>
                TrackerRepository.trackEvent(
                  `${eventNamePrefix}.previousProfileNotFound` as NonEmptyString,
                  undefined,
                  false,
                  {
                    _self,
                    fiscalCode: hashFiscalCode(fiscalCode)
                  }
                )
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
): RTE.ReaderTaskEither<FunctionDependencies, Error, void> => deps =>
  profile.version === 0
    ? profile.email && profile.isEmailValidated
      ? deps.ProfileEmailRepository.emailInsert({
          email: profile.email,
          fiscalCode: profile.fiscalCode
        })(deps)
      : TE.right<Error, void>(void 0)
    : handlePositiveVersion(profile)(deps);

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
            dependencies.TrackerRepository.trackEvent(
              `${eventNamePrefix}.decodingProfile` as NonEmptyString,
              undefined,
              false,
              {
                _self:
                  typeof document === "object" &&
                  document !== null &&
                  "_self" in document
                    ? document._self
                    : "unknown-id"
              }
            )(dependencies);
            return TE.right(void 0);
          },
          profileDocument =>
            pipe(
              dependencies,
              handleProfile(profileDocument),
              TE.mapLeft(error => {
                dependencies.TrackerRepository.trackEvent(
                  `${eventNamePrefix}.handlingProfile` as NonEmptyString,
                  undefined,
                  false,
                  {
                    _self: profileDocument._self,
                    error,
                    fiscalCode: hashFiscalCode(profileDocument.fiscalCode)
                  }
                )(dependencies);
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
