import * as crypto from "crypto";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";

import { ContainerClient } from "@azure/storage-blob";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { MagicLinkData } from "../generated/definitions/internal/MagicLinkData";
import { MagicLinkToken } from "../generated/definitions/internal/MagicLinkToken";
import { getGenerateJWE } from "../utils/jwe";
import { storeAuditLog } from "../utils/audit-log";
import { OperationTypes } from "../utils/enums/OperationTypes";

type MagicLinkErrorResponsesT = IResponseErrorInternal;

type MagicLinkHandlerT = (
  payload: MagicLinkData
) => Promise<IResponseSuccessJson<MagicLinkToken> | MagicLinkErrorResponsesT>;

export const magicLinkHandler = (
  issuer: NonEmptyString,
  publicKey: NonEmptyString,
  ttl: number,
  magicLinkBaseUrl: NonEmptyString,
  containerClient: ContainerClient
  // eslint-disable-next-line max-params
): MagicLinkHandlerT => (reqPayload): ReturnType<MagicLinkHandlerT> => {
  const jti = crypto.randomUUID() as NonEmptyString;
  const iat = Date.now() / 1000;
  return pipe(
    getGenerateJWE(issuer, jti, iat, publicKey)(reqPayload, ttl as Second),
    TE.mapLeft(e =>
      ResponseErrorInternal(
        `Something gone wrong generating magic link JWE: ${e}`
      )
    ),
    TE.chain(jwe =>
      pipe(
        storeAuditLog(
          containerClient,
          {
            ip: reqPayload.ip
          },
          {
            DateTime: new Date(iat * 1000).toISOString(),
            FiscalCode: hashFiscalCode(reqPayload.fiscal_number),
            IDToken: jti,
            Type: OperationTypes.ISSUING
          }
        ),
        TE.mapLeft(err =>
          ResponseErrorInternal(
            `Cannot store audit log | ERROR= ${err.message}`
          )
        ),
        TE.map(_ =>
          ResponseSuccessJson({
            // safe cast because the variables referenced are both non-empty strings
            magic_link: `${magicLinkBaseUrl}#token=${jwe}` as NonEmptyString
          })
        )
      )
    ),
    TE.toUnion
  )();
};

export const getMagicLinkHandler = (
  issuer: NonEmptyString,
  publicKey: NonEmptyString,
  ttl: number,
  magicLinkBaseUrl: NonEmptyString,
  containerClient: ContainerClient
  // eslint-disable-next-line max-params
) => {
  const handler = magicLinkHandler(
    issuer,
    publicKey,
    ttl,
    magicLinkBaseUrl,
    containerClient
  );
  const middlewares = [
    ContextMiddleware(),
    RequiredBodyPayloadMiddleware(MagicLinkData)
  ] as const;

  return wrapHandlerV4(middlewares, (_, payload) => handler(payload));
};
