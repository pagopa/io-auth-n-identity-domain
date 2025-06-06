import express from "express";

import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePreference";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler,
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

import {
  IResponseErrorQuery,
  ResponseErrorQuery,
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import {
  Profile,
  ProfileModel,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  makeServicesPreferencesDocumentId,
  ServicesPreferencesModel,
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  IResponseErrorConflict,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";

import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { pipe } from "fp-ts/lib/function";
import { sequenceS } from "fp-ts/lib/Apply";
import {
  Service,
  ServiceModel,
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { ServiceCategory } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceCategory";
import { SpecialServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/SpecialServiceCategory";
import { ActivationModel } from "@pagopa/io-functions-commons/dist/src/models/activation";
import {
  getServiceCategoryOrStandard,
  getServiceOrErrorResponse,
} from "../utils/services";
import {
  getServicePreferenceSettingsVersion,
  getServicePreferencesForSpecialServices,
  nonLegacyServicePreferences,
  toDefaultDisabledUserServicePreference,
  toDefaultEnabledUserServicePreference,
  toUserServicePreferenceFromModel,
} from "../utils/service-preferences";
import { getProfileOrErrorResponse } from "../utils/profiles";

type IGetServicePreferencesHandlerResult =
  | IResponseSuccessJson<ServicePreference>
  | IResponseErrorNotFound
  | IResponseErrorConflict
  | IResponseErrorQuery;

const NonLegacyProfile = t.intersection([
  Profile,
  t.type({
    servicePreferencesSettings: t.type({
      mode: t.union([
        t.literal(ServicesPreferencesModeEnum.AUTO),
        t.literal(ServicesPreferencesModeEnum.MANUAL),
      ]),
      version: NonNegativeInteger,
    }),
  }),
]);
type NonLegacyProfile = t.TypeOf<typeof NonLegacyProfile>;

/**
 * Type of a GetServicePreferences handler.
 *
 * GetServicePreferences expects a FiscalCode as input and returns a Profile or
 * a Not Found error.
 */
type IGetServicePreferencesHandler = (
  fiscalCode: FiscalCode,
  serviceId: ServiceId,
) => Promise<IGetServicePreferencesHandlerResult>;

/**
 * Return a function that returns the service preference for the
 * given documentId and version, or a default value if not present
 * The default value depends on the user' settings (mode AUTO/MANUAL)
 *
 * @param servicePreferencesModel The service preferences cosmos model
 * @param fiscalCode the fiscal code
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export declare type getUserServicePreferencesT = (params: {
  readonly serviceId: ServiceId;
  readonly mode:
    | ServicesPreferencesModeEnum.AUTO
    | ServicesPreferencesModeEnum.MANUAL;
  readonly version: NonNegativeInteger;
  readonly fiscalCode: FiscalCode;
  readonly serviceCategory: ServiceCategory;
}) => TE.TaskEither<
  IResponseErrorQuery,
  {
    readonly serviceCategory: ServiceCategory;
    readonly servicePreferences: ServicePreference;
  }
>;
const getUserServicePreferencesOrDefault =
  (
    servicePreferencesModel: ServicesPreferencesModel,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  ): getUserServicePreferencesT =>
  ({ fiscalCode, serviceId, mode, version, serviceCategory }) =>
    pipe(
      servicePreferencesModel.find([
        makeServicesPreferencesDocumentId(fiscalCode, serviceId, version),
        fiscalCode,
      ]),
      TE.mapLeft((failure) =>
        ResponseErrorQuery(
          "Error while retrieving the user's service preferences",
          failure,
        ),
      ),
      TE.map((maybeServicePref) =>
        pipe(
          maybeServicePref,
          O.fold(
            () => {
              // eslint-disable-next-line default-case
              switch (mode) {
                case ServicesPreferencesModeEnum.AUTO:
                  return toDefaultEnabledUserServicePreference(version);
                case ServicesPreferencesModeEnum.MANUAL:
                  return toDefaultDisabledUserServicePreference(version);
                default:
                  return void 0 as never;
              }
            },
            (pref) => toUserServicePreferenceFromModel(pref),
          ),
        ),
      ),
      TE.map((_) => ({
        serviceCategory,
        servicePreferences: _,
      })),
    );

/**
 * Return a type safe GetServicePreferences handler.
 */
export const GetServicePreferencesHandler = (
  profileModel: ProfileModel,
  serviceModel: ServiceModel,
  servicePreferencesModel: ServicesPreferencesModel,
  activationModel: ActivationModel,
  // eslint-disable-next-line arrow-body-style
): IGetServicePreferencesHandler => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (fiscalCode, serviceId) =>
    pipe(
      sequenceS(TE.ApplicativeSeq)({
        profile: getProfileOrErrorResponse(profileModel)(fiscalCode),
        service: getServiceOrErrorResponse(serviceModel)(serviceId),
      }),
      TE.chainW(
        TE.fromPredicate(
          (
            entities,
          ): entities is {
            readonly profile: NonLegacyProfile;
            readonly service: Service;
          } => nonLegacyServicePreferences(entities.profile),
          () => ResponseErrorConflict("Legacy service preferences not allowed"),
        ),
      ),
      TE.chainW(({ profile, service }) =>
        pipe(
          getServicePreferenceSettingsVersion(profile),
          TE.mapLeft((_) =>
            ResponseErrorConflict(
              "Service Preferences Version < 0 not allowed",
            ),
          ),
          TE.map((version) => ({
            fiscalCode,
            mode: profile.servicePreferencesSettings.mode,
            serviceCategory: getServiceCategoryOrStandard(service),
            serviceId,
            version,
          })),
        ),
      ),
      TE.chainW(getUserServicePreferencesOrDefault(servicePreferencesModel)),
      TE.chainW(({ serviceCategory, servicePreferences }) => {
        if (serviceCategory === SpecialServiceCategoryEnum.SPECIAL) {
          return getServicePreferencesForSpecialServices(activationModel)({
            fiscalCode,
            serviceId,
            servicePreferences,
          });
        }
        return TE.of(servicePreferences);
      }),
      TE.map(ResponseSuccessJson),
      TE.toUnion,
    )();
};

/**
 * Wraps a GetServicePreferences handler inside an Express request handler.
 */
export function GetServicePreferences(
  profileModel: ProfileModel,
  serviceModel: ServiceModel,
  servicePreferencesModel: ServicesPreferencesModel,
  activationModel: ActivationModel,
): express.RequestHandler {
  const handler = GetServicePreferencesHandler(
    profileModel,
    serviceModel,
    servicePreferencesModel,
    activationModel,
  );

  const middlewaresWrap = withRequestMiddlewares(
    // ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("serviceId", ServiceId),
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
