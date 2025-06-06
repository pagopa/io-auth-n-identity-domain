import { Context } from "@azure/functions";
import {
  FiscalCode,
  IPString,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { flow, pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { TransientNotImplementedFailure } from "../utils/durable";
import { MagicLinkServiceClient } from "../utils/magic-code";

// magic link service response
const MagicLinkServiceResponse = t.type({
  magic_link: NonEmptyString,
});

type MagicLinkServiceResponse = t.TypeOf<typeof MagicLinkServiceResponse>;

// Activity input
export const ActivityInput = t.intersection([
  t.type({
    family_name: NonEmptyString,
    fiscal_code: FiscalCode,
    name: NonEmptyString,
  }),
  // TODO: remove the following partial type.
  // The partial type here is used to allow the IP field to be missing
  // during the rollout of the new feature.
  // Task: https://pagopa.atlassian.net/browse/IOPID-2883
  t.partial({
    ip: IPString,
  }),
]);

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
export const ActivityResultSuccess = t.type({
  kind: t.literal("SUCCESS"),
  value: MagicLinkServiceResponse,
});

const GeneralFailure = t.type({
  kind: t.literal("FAILURE"),
  reason: t.string,
});

type GeneralFailure = t.TypeOf<typeof GeneralFailure>;

const ActivityResultFailure = t.union([
  GeneralFailure,
  TransientNotImplementedFailure,
]);

export const ActivityResult = t.union([
  ActivityResultSuccess,
  ActivityResultFailure,
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

const logPrefix = "GetMagicCodeActivity";

export const getMagicCodeActivityHandler =
  (magicLinkService: MagicLinkServiceClient) =>
  async (context: Context, input: unknown): Promise<ActivityResult> =>
    pipe(
      input,
      ActivityInput.decode,
      E.mapLeft((errors) => {
        context.log.error(
          `${logPrefix}|Error while decoding input|ERROR=${readableReportSimplified(
            errors,
          )}`,
        );

        return ActivityResultFailure.encode({
          kind: "FAILURE",
          reason: "Error while decoding input",
        });
      }),
      TE.fromEither,
      TE.chain(({ name, family_name, fiscal_code, ip }) =>
        pipe(
          TE.tryCatch(
            () =>
              magicLinkService.getMagicLinkToken({
                body: {
                  family_name,
                  fiscal_number: fiscal_code,
                  name,
                  ip: pipe(
                    NonEmptyString.decode(ip),
                    E.getOrElseW(() => "UNKNOWN" as NonEmptyString),
                  ),
                },
              }),
            (error) => {
              context.log.error(
                `${logPrefix}|Error while calling magic link service|ERROR=${error}`,
              );
              return ActivityResultFailure.encode({
                kind: "FAILURE",
                reason: `Error while calling magic link service: ${error}`,
              });
            },
          ),
          TE.chainEitherKW(
            flow(
              E.mapLeft((errors) =>
                ActivityResultFailure.encode({
                  kind: "FAILURE",
                  reason: `magic link service returned an unexpected response: ${readableReportSimplified(
                    errors,
                  )}`,
                }),
              ),
            ),
          ),
          TE.chain(({ status, value }) =>
            status === 200
              ? TE.right(value)
              : TE.left(
                  ActivityResultFailure.encode({
                    kind: "FAILURE",
                    reason: `magic link service returned ${status}`,
                  }),
                ),
          ),
        ),
      ),
      TE.map((serviceResponse) =>
        ActivityResultSuccess.encode({
          kind: "SUCCESS",
          value: serviceResponse,
        }),
      ),
      TE.toUnion,
    )();
