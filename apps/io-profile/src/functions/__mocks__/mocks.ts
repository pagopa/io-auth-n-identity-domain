import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString,
  Semver,
} from "@pagopa/ts-commons/lib/strings";

import { NewProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/NewProfile";
import { Profile } from "@pagopa/io-functions-commons/dist/generated/definitions/Profile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { UserDataProcessing as UserDataProcessingApi } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessing";
import {
  UserDataProcessingChoice,
  UserDataProcessingChoiceEnum,
} from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingChoiceRequest } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoiceRequest";
import {
  UserDataProcessingStatus,
  UserDataProcessingStatusEnum,
} from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  makeUserDataProcessingId,
  RetrievedUserDataProcessing,
  UserDataProcessingId,
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { CosmosResource } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { retrievedProfileToExtendedProfile } from "../../utils/profiles";
import { toUserDataProcessingApi } from "../../utils/user-data-processings";

export const aName = "EXAMPLE_NAME";
export const aEmail = "email@example.com" as EmailString;
export const aEmailChanged = "email.changed@example.com" as EmailString;

export const aFiscalCode = "SPNDNL80A13Y555X" as FiscalCode;
export const anotherFiscalCode = "AAABBB01C02D345W" as FiscalCode;

export const anIPAddress = "127.0.0.1";

// CosmosResourceMetadata
export const aCosmosResourceMetadata: Omit<CosmosResource, "id"> = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
};

export const aNewProfile: NewProfile = {
  email: aEmail,
  is_email_validated: true,
};

export const legacyApiProfileServicePreferencesSettings: Profile["service_preferences_settings"] =
  {
    mode: ServicesPreferencesModeEnum.LEGACY,
  };

export const autoApiProfileServicePreferencesSettings: Profile["service_preferences_settings"] =
  {
    mode: ServicesPreferencesModeEnum.AUTO,
  };

export const manualApiProfileServicePreferencesSettings: Profile["service_preferences_settings"] =
  {
    mode: ServicesPreferencesModeEnum.MANUAL,
  };

export const aProfile: Profile = {
  email: aEmail,
  is_email_enabled: true,
  is_inbox_enabled: false,
  is_webhook_enabled: false,
  service_preferences_settings: legacyApiProfileServicePreferencesSettings,
  version: 0 as NonNegativeInteger,
  last_app_version: "0.0.1" as Semver,
};

export const legacyProfileServicePreferencesSettings: RetrievedProfile["servicePreferencesSettings"] =
  {
    mode: ServicesPreferencesModeEnum.LEGACY,
    version: -1,
  };

export const autoProfileServicePreferencesSettings: RetrievedProfile["servicePreferencesSettings"] =
  {
    mode: ServicesPreferencesModeEnum.AUTO,
    version: 0 as NonNegativeInteger,
  };

export const manualProfileServicePreferencesSettings: RetrievedProfile["servicePreferencesSettings"] =
  {
    mode: ServicesPreferencesModeEnum.MANUAL,
    version: 1 as NonNegativeInteger,
  };

export const aRetrievedProfile: RetrievedProfile = {
  ...aCosmosResourceMetadata,
  fiscalCode: aFiscalCode,
  id: "123" as NonEmptyString,
  email: "anemail@email.it" as EmailString,
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: false,
  isTestProfile: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  servicePreferencesSettings: legacyProfileServicePreferencesSettings,
  version: 0 as NonNegativeInteger,
  lastAppVersion: "0.0.1" as Semver,
};

export const aRetrievedProfileWithEmail: RetrievedProfile = {
  ...aCosmosResourceMetadata,
  email: "email@example.com" as EmailString,
  fiscalCode: aFiscalCode,
  id: "123" as NonEmptyString,
  isEmailEnabled: true,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  servicePreferencesSettings: legacyProfileServicePreferencesSettings,
  version: 0 as NonNegativeInteger,
  lastAppVersion: "0.0.1" as Semver,
};

export const aNewDate = new Date();

export const aExtendedProfile =
  retrievedProfileToExtendedProfile(aRetrievedProfile);
export const aExtendedProfileWithEmail = retrievedProfileToExtendedProfile(
  aRetrievedProfileWithEmail,
);

export const aTokenId = "01DQ79RZ0EQ0S7RTA3SMCKRCCA";
export const aValidator = "d6e57ed8d3c3eb4583d671c7";
export const aValidatorHash =
  "35aef908716592e5dd48ccc4f58ef1a286de8dfd58d9a7a050cf47c60b662154";

export const aUserDataProcessingChoice: UserDataProcessingChoice =
  UserDataProcessingChoiceEnum.DOWNLOAD;

export const aUserDataProcessingChoiceRequest: UserDataProcessingChoiceRequest =
  {
    choice: aUserDataProcessingChoice,
  };

export const aUserDataProcessingId: UserDataProcessingId =
  makeUserDataProcessingId(aUserDataProcessingChoice, aFiscalCode);

export const aUserDataProcessingStatus: UserDataProcessingStatus =
  UserDataProcessingStatusEnum.PENDING;

export const aWipUserDataProcessingStatus: UserDataProcessingStatus =
  UserDataProcessingStatusEnum.WIP;

export const aClosedUserDataProcessingStatus: UserDataProcessingStatus =
  UserDataProcessingStatusEnum.CLOSED;

export const aAbortedUserDataProcessingStatus: UserDataProcessingStatus =
  UserDataProcessingStatusEnum.ABORTED;

export const aRetrievedUserDataProcessing: RetrievedUserDataProcessing = {
  ...aCosmosResourceMetadata,
  choice: aUserDataProcessingChoice,
  createdAt: aNewDate,
  fiscalCode: aFiscalCode,
  id: "xyz" as NonEmptyString,
  kind: "IRetrievedUserDataProcessing",
  status: aUserDataProcessingStatus,
  updatedAt: aNewDate,
  userDataProcessingId: aUserDataProcessingId,
  version: 0 as NonNegativeInteger,
};

export const aClosedRetrievedUserDataProcessing: RetrievedUserDataProcessing = {
  ...aRetrievedUserDataProcessing,
  status: aClosedUserDataProcessingStatus,
};

export const aWipRetrievedUserDataProcessing: RetrievedUserDataProcessing = {
  ...aRetrievedUserDataProcessing,
  status: aWipUserDataProcessingStatus,
};

export const aAbortedRetrievedUserDataProcessing: RetrievedUserDataProcessing =
  {
    ...aRetrievedUserDataProcessing,
    status: aAbortedUserDataProcessingStatus,
  };

export const aUserDataProcessingApi: UserDataProcessingApi =
  toUserDataProcessingApi(aRetrievedUserDataProcessing);

export const aWipUserDataProcessingApi: UserDataProcessingApi =
  toUserDataProcessingApi(aWipRetrievedUserDataProcessing);
