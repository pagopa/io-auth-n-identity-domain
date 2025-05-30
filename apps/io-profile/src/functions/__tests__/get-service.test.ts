// eslint-disable @typescript-eslint/no-explicit-any
import { none, some } from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaxAllowedPaymentAmount } from "@pagopa/io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";
import { NotificationChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/NotificationChannel";
import { ServicePublic } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePublic";
import {
  NewService,
  RetrievedService,
  Service,
  toAuthorizedCIDRs,
  toAuthorizedRecipients,
} from "@pagopa/io-functions-commons/dist/src/models/service";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode,
} from "@pagopa/ts-commons/lib/strings";

import { aCosmosResourceMetadata } from "../__mocks__/mocks";
import {
  GetServiceHandler,
  serviceAvailableNotificationChannels,
} from "../get-service";

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aServicePayload: ServicePublic = {
  department_name: "MyDeptName" as NonEmptyString,
  organization_fiscal_code: anOrganizationFiscalCode,
  organization_name: "MyOrgName" as NonEmptyString,
  service_id: "MySubscriptionId" as NonEmptyString,
  service_name: "MyServiceName" as NonEmptyString,
  version: 1,
};

const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDeptName" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrgName" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: "MySubscriptionId" as NonEmptyString,
  serviceName: "MyServiceName" as NonEmptyString,
};

const aNewService: NewService = {
  ...aService,
  kind: "INewService",
};

const aRetrievedService: RetrievedService = {
  ...aNewService,
  ...aCosmosResourceMetadata,
  id: "123" as NonEmptyString,
  kind: "IRetrievedService",
  version: 1 as NonNegativeInteger,
};

const aSeralizedService: ServicePublic = {
  ...aServicePayload,
  available_notification_channels: [
    NotificationChannelEnum.EMAIL,
    NotificationChannelEnum.WEBHOOK,
  ],
  version: 1 as NonNegativeInteger,
};

describe("serviceAvailableNotificationChannels", () => {
  it("should return an array with the right notification channels", () => {
    expect(serviceAvailableNotificationChannels(aRetrievedService)).toEqual([
      NotificationChannelEnum.EMAIL,
      NotificationChannelEnum.WEBHOOK,
    ]);

    expect(
      serviceAvailableNotificationChannels({
        ...aRetrievedService,
        requireSecureChannels: true,
      }),
    ).toEqual([NotificationChannelEnum.WEBHOOK]);
  });
});

describe("GetServiceHandler", () => {
  it("should get an existing service", async () => {
    const serviceModelMock = {
      findOneByServiceId: vi.fn(() => TE.of(some(aRetrievedService))),
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(aServiceId);
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId,
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aSeralizedService);
    }
  });
  it("should fail on errors during get", async () => {
    const serviceModelMock = {
      findOneByServiceId: vi.fn(() => TE.left(none)),
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(aServiceId);
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId,
    );
    expect(response.kind).toBe("IResponseErrorQuery");
  });
  it("should return not found if the service does not exist", async () => {
    const serviceModelMock = {
      findOneByServiceId: vi.fn(() => TE.of(none)),
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(aServiceId);
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId,
    );
    expect(response.kind).toBe("IResponseErrorNotFound");
  });
});
