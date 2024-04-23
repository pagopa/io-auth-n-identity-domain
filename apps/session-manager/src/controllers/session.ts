import * as express from "express";
import { withUserFromRequest } from "../utils/user";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import crypto from "crypto";
import * as TE from "fp-ts/TaskEither";
import {
  getLollipopAssertionRefForUser,
  update,
} from "../services/redis-session-storage";
import * as E from "fp-ts/Either";
import { UserV2, UserV3, UserV4, UserV5 } from "../types/user";
import { pipe } from "fp-ts/lib/function";
import { RedisClientSelectorType } from "../repositories/redis";
import * as O from "fp-ts/Option";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  ZendeskToken,
} from "../types/token";
import { log } from "../utils/logger";
import { profileWithEmailValidatedOrError } from "./profile";
import { APIClient } from "../repositories/api";
import { PublicSession } from "../generated/backend/PublicSession";
import { getNewToken } from "../services/token";

// how many random bytes to generate for each session token
export const SESSION_TOKEN_LENGTH_BYTES = 48;

export const getSessionState =
  (
    redisClientSelector: RedisClientSelectorType,
    apiClient: ReturnType<APIClient>,
  ) =>
  (
    req: express.Request,
  ): Promise<
    | IResponseErrorInternal
    | IResponseErrorValidation
    | IResponseSuccessJson<PublicSession>
  > =>
    withUserFromRequest(req, async (user) => {
      const zendeskSuffix = await pipe(
        profileWithEmailValidatedOrError(apiClient)(user),
        TE.bimap(
          // we generate 4 bytes and convert them to hex string for a length of 8 chars
          (_) => crypto.randomBytes(4).toString("hex"),
          // or we take 8 chars from the hash hex string
          (p) =>
            crypto
              .createHash("sha256")
              .update(p.email)
              .digest("hex")
              .substring(0, 8),
        ),
        TE.toUnion,
      )();

      // Read the assertionRef related to the User for Lollipop.
      const errorOrMaybeAssertionRef = await getLollipopAssertionRefForUser(
        redisClientSelector,
      )(user.fiscal_code)();
      if (E.isLeft(errorOrMaybeAssertionRef)) {
        return ResponseErrorInternal(
          `Error retrieving the assertionRef: ${errorOrMaybeAssertionRef.left.message}`,
        );
      }

      if (UserV5.is(user)) {
        // All required tokens are present on the current session, no update is required
        return ResponseSuccessJson({
          bpdToken: user.bpd_token,
          fimsToken: user.fims_token,
          lollipopAssertionRef: O.toUndefined(errorOrMaybeAssertionRef.right),
          myPortalToken: user.myportal_token,
          spidLevel: user.spid_level,
          walletToken: user.wallet_token,
          zendeskToken: `${user.zendesk_token}${zendeskSuffix}`,
        });
      }

      // If the myportal_token, zendesk_token or bpd_token are missing into the user session,
      // new tokens are generated and the session is updated
      const updatedUser: UserV5 = {
        ...user,
        bpd_token: UserV3.is(user)
          ? user.bpd_token
          : (getNewToken(SESSION_TOKEN_LENGTH_BYTES) as BPDToken),
        fims_token: getNewToken(SESSION_TOKEN_LENGTH_BYTES) as FIMSToken,
        myportal_token: UserV2.is(user)
          ? user.myportal_token
          : (getNewToken(SESSION_TOKEN_LENGTH_BYTES) as MyPortalToken),
        zendesk_token: UserV4.is(user)
          ? user.zendesk_token
          : (getNewToken(SESSION_TOKEN_LENGTH_BYTES) as ZendeskToken),
      };

      return pipe(
        update(redisClientSelector)(updatedUser),
        TE.mapLeft((err) => {
          log.error(`getSessionState: ${err.message}`);
          return ResponseErrorInternal(
            `Error updating user session [${err.message}]`,
          );
        }),
        TE.map((_) =>
          ResponseSuccessJson({
            bpdToken: updatedUser.bpd_token,
            fimsToken: updatedUser.fims_token,
            lollipopAssertionRef: O.toUndefined(errorOrMaybeAssertionRef.right),
            myPortalToken: updatedUser.myportal_token,
            spidLevel: updatedUser.spid_level,
            walletToken: updatedUser.wallet_token,
            zendeskToken: `${updatedUser.zendesk_token}${zendeskSuffix}`,
          }),
        ),
        TE.toUnion,
      )();
    });
