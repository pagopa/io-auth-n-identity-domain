import { ActivationStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ActivationStatus";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePreference";
import { Activation } from "@pagopa/io-functions-commons/dist/src/models/activation";
import {
  RetrievedService,
  toAuthorizedCIDRs,
  toAuthorizedRecipients,
} from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  AccessReadMessageStatusEnum,
  makeServicesPreferencesDocumentId,
  NewServicePreference,
  RetrievedServicePreference,
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode,
} from "@pagopa/ts-commons/lib/strings";
import { CIDR } from "@pagopa/io-functions-commons/dist/generated/definitions/CIDR";
import { aCosmosResourceMetadata, aFiscalCode } from "./mocks";

export const aServiceId = "aServiceId" as ServiceId;
export const aServicePreferenceVersion = 0 as NonNegativeInteger;

export const aNewServicePreference: NewServicePreference = {
  accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
  isEmailEnabled: true,
  isInboxEnabled: true,
  isWebhookEnabled: true,
  settingsVersion: aServicePreferenceVersion,
  fiscalCode: aFiscalCode,
  serviceId: aServiceId,
  kind: "INewServicePreference",
  id: makeServicesPreferencesDocumentId(
    aFiscalCode,
    aServiceId,
    aServicePreferenceVersion,
  ),
};
export const aRetrievedServicePreference: RetrievedServicePreference = {
  ...aCosmosResourceMetadata,
  ...aNewServicePreference,
  kind: "IRetrievedServicePreference",
};

export const aServicePreference: ServicePreference = {
  can_access_message_read_status: true,
  is_email_enabled: true,
  is_inbox_enabled: true,
  is_webhook_enabled: true,
  settings_version: aServicePreferenceVersion,
};

export const aRetrievedService: RetrievedService = {
  ...aCosmosResourceMetadata,
  serviceId: aServiceId,
  isVisible: true,
  id: aServiceId,
  serviceName: "a Service" as NonEmptyString,
  organizationName: "a Organization" as NonEmptyString,
  departmentName: "a name" as NonEmptyString,
  authorizedCIDRs: toAuthorizedCIDRs(["0.0.0.0"]),
  authorizedRecipients: toAuthorizedRecipients(["AAAAAA00A00A000A"]),
  organizationFiscalCode: "00000000000" as OrganizationFiscalCode,
  maxAllowedPaymentAmount: 9999999999,
  requireSecureChannels: false,
  version: 0 as NonNegativeInteger,
  kind: "IRetrievedService",
};

export const anActiveActivation: Activation = {
  ...aCosmosResourceMetadata,
  fiscalCode: aFiscalCode,
  serviceId: aServiceId,
  status: ActivationStatusEnum.ACTIVE,
};
