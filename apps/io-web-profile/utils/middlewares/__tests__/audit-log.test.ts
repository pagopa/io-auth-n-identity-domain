import * as auditLog from '../../audit-log';
import * as handler from '../../audit-log';
import { BlobServiceClient, BlockBlobUploadResponse, ContainerClient, RestError } from '@azure/storage-blob';
import { AuditActionDoc, AuditExchangeDoc, ExchangeTag, storeAuditLog } from '../../audit-log';
import * as TE from "fp-ts/TaskEither";
import { config as mockedConfig } from "../../../__mocks__/config.mock";
import { FiscalCode } from '@pagopa/ts-commons/lib/strings';
import { TokenTypes } from '../../enums/TokenTypes';
import { isLeft, isRight } from 'fp-ts/lib/Either';
import { OperationTypes } from '../../enums/OperationTypes';

const config = { ...mockedConfig }

describe('Audit Logs Utils', () => {

  const aValidExchangeAuditLogDoc: AuditExchangeDoc = {
    ip: '127.0.0.1',
    fatherTokenId: 'token123',
    tokenIssuingTime: '2022-01-01T12:00:00Z',
  };

  const aValidExchangeAuditLogTags: ExchangeTag = {
    FatherIDToken: 'parentToken123',
    FiscalCode: '12345678901' as FiscalCode,
    DateTime: '2022-01-01T12:00:00Z',
    IDToken: 'token123',
    Ip: '127.0.0.1',
    Type: 'exchange' as OperationTypes.EXCHANGE,
  };

  const containerClient = BlobServiceClient.fromConnectionString(
    config.AUDIT_LOG_CONNECTION_STRING
  ).getContainerClient(config.AUDIT_LOG_CONTAINER);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('storeAuditLog fail return RestError', async () => {

    const mockStoreAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.left({} as RestError));

    const result = await storeAuditLog(containerClient, aValidExchangeAuditLogDoc, aValidExchangeAuditLogTags)();

    expect(mockStoreAuditLog).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBe(true);
  });

  test('storeAuditLog success', async () => {

    const mockStoreAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));


    const result = await storeAuditLog(containerClient, aValidExchangeAuditLogDoc, aValidExchangeAuditLogTags)();
    expect(mockStoreAuditLog).toHaveBeenCalledTimes(1);

    expect(isRight(result)).toBe(true);
  });
});
