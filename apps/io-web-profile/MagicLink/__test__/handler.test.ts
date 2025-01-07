import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  BlobServiceClient,
  BlockBlobUploadResponse,
  RestError
} from "@azure/storage-blob";
import * as TE from "fp-ts/TaskEither";
import { unknown } from "io-ts";
import { magicLinkHandler } from "../handler";
import { config as mockedConfig } from "../../__mocks__/config.mock";
import * as auditLog from "../../utils/audit-log";

import { config } from "../../__mocks__/config.mock";
import { MagicLinkData } from "../../generated/definitions/internal/MagicLinkData";

const containerClient = BlobServiceClient.fromConnectionString(
  mockedConfig.AUDIT_LOG_CONNECTION_STRING
).getContainerClient(mockedConfig.AUDIT_LOG_CONTAINER);

const aValidPayload = {
  family_name: "Rossi" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  ip: "127.0.0.1" as NonEmptyString,
  name: "Carla" as NonEmptyString
};

describe("MagicLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const handler = magicLinkHandler(
    config.MAGIC_LINK_JWE_ISSUER,
    config.MAGIC_LINK_JWE_PRIMARY_PUB_KEY,
    config.MAGIC_LINK_JWE_TTL,
    config.MAGIC_LINK_BASE_URL,
    containerClient
  );

  it(`SHOULD generate a valid magic link token and send it as a response 
      if the audit log operation is successful`, async () => {
    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));

    const res = await handler(aValidPayload);

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        magic_link: expect.stringMatching(
          `${config.MAGIC_LINK_BASE_URL}#token=[A-Za-z0-9-_]{1,520}`
        )
      }
    });
  });
  // eslint-disable-next-line sonarjs/no-identical-functions
  it(`SHOULD generate a valid magic link token 
      and send a status code 500 if the audit log operation fails`, async () => {
    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.left({} as RestError));

    const res = await handler(aValidPayload);

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      kind: "IResponseErrorInternal"
    });
  });

  it(`IF the payload does not include an IP address, 
      SHOULD generate a valid magic link token and send it as a response
      if the audit log operation is successful`, async () => {
    const aValidPayloadWithoutIp: MagicLinkData = {
      family_name: "Rossi" as NonEmptyString,
      fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
      ip: (unknown as unknown) as NonEmptyString,
      name: "Carla" as NonEmptyString
    };

    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));

    const res = await handler(aValidPayloadWithoutIp);

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        magic_link: expect.stringMatching(
          `${config.MAGIC_LINK_BASE_URL}#token=[A-Za-z0-9-_]{1,520}`
        )
      }
    });
  });
});
