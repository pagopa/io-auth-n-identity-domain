import { randomBytes } from "crypto";
import * as t from "io-ts";
import * as TE from "fp-ts/TaskEither";
import {
  BlockBlobUploadResponse,
  ContainerClient,
  RestError
} from "@azure/storage-blob";
import { OperationTypes } from "./enums/OperationTypes";
import { BaseJwtPayload } from "./jwt";

/**
 * File name pattern "${hash(CF)}-${UTCDateTime}-tokentype-IdToken-randomBytes(3)".
 *
 * @param fiscal_number User Fiscal Number
 * @param token_type Token Type
 * @param token_id Token ID
 * @returns File Name
 */

export const generateBlobName = (
  fiscal_number_hashed: string,
  token_type: OperationTypes,
  token_id: string
): string => {
  const UTCDateTime = new Date().toISOString();
  const randomBytesPart = randomBytes(3).toString("hex");
  return `${fiscal_number_hashed}-${UTCDateTime}-${token_type}-${token_id}-${randomBytesPart}`;
};

const AuditExchangeDoc = t.type({
  fatherTokenId: t.string,
  ip: t.string,
  tokenIssuingTime: t.string
});

const AuditActionDoc = t.type({
  ip: t.string,
  jwtPayload: BaseJwtPayload
});

const AuditIssuingDoc = t.type({
  ip: t.string
});

const ExchangeTag = t.type({
  DateTime: t.string,
  FatherIDToken: t.string,
  FiscalCode: t.string,
  IDToken: t.string,
  Ip: t.string,
  Type: t.literal(OperationTypes.EXCHANGE)
});

const ActionTag = t.type({
  DateTime: t.string,
  FiscalCode: t.string,
  IDToken: t.string,
  Ip: t.string,
  Type: t.union([
    t.literal(OperationTypes.LOGOUT),
    t.literal(OperationTypes.LOCK),
    t.literal(OperationTypes.UNLOCK)
  ])
});

const IssuingTag = t.type({
  DateTime: t.string,
  FiscalCode: t.string,
  IDToken: t.string,
  Type: t.literal(OperationTypes.ISSUING)
});

export type AuditExchangeDoc = t.TypeOf<typeof AuditExchangeDoc>;
export type AuditActionDoc = t.TypeOf<typeof AuditActionDoc>;
export type AuditIssuingDoc = t.TypeOf<typeof AuditIssuingDoc>;

export type ExchangeTag = t.TypeOf<typeof ExchangeTag>;
export type ActionTag = t.TypeOf<typeof ActionTag>;
export type IssuingTag = t.TypeOf<typeof IssuingTag>;

export type AuditLogContent = t.TypeOf<typeof AuditLogContent>;
const AuditLogContent = t.union([
  AuditActionDoc,
  AuditExchangeDoc,
  AuditIssuingDoc
]);

const encodeAuditLogDoc = (doc: AuditLogContent): string => {
  if (AuditLogContent.is(doc)) {
    return JSON.stringify(AuditLogContent.encode(doc));
  } else {
    throw new Error("Invalid type");
  }
};

export function storeAuditLog(
  containerClient: ContainerClient,
  auditLogDoc: AuditIssuingDoc,
  tags: IssuingTag
): TE.TaskEither<RestError, BlockBlobUploadResponse>;

export function storeAuditLog(
  containerClient: ContainerClient,
  auditLogDoc: AuditExchangeDoc,
  tags: ExchangeTag
): TE.TaskEither<RestError, BlockBlobUploadResponse>;

export function storeAuditLog(
  containerClient: ContainerClient,
  auditLogDoc: AuditActionDoc,
  tags: ActionTag
): TE.TaskEither<RestError, BlockBlobUploadResponse>;
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function storeAuditLog(
  containerClient: ContainerClient,
  auditLogDoc: AuditExchangeDoc | AuditActionDoc | AuditIssuingDoc,
  tags: ExchangeTag | ActionTag | IssuingTag
): TE.TaskEither<RestError, BlockBlobUploadResponse> {
  return TE.tryCatch(
    () => {
      const content = encodeAuditLogDoc(auditLogDoc);
      const blockBlobClient = containerClient.getBlockBlobClient(
        generateBlobName(tags.FiscalCode, tags.Type, tags.IDToken)
      );
      return blockBlobClient.upload(content, content.length, { tags });
    },
    err => (err instanceof RestError ? err : new RestError(String(err)))
  );
}
