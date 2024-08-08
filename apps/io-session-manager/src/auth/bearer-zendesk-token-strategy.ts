import * as passport from "passport-http-custom-bearer";
import * as express from "express";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { RedisClientSelectorType } from "../types/redis";
import { StrategyDoneFunction, fulfill } from "../utils/strategies";
import { SESSION_TOKEN_LENGTH_BYTES } from "../controllers/session";
import { ZendeskToken } from "../types/token";
import { User } from "../types/user";
import { RedisSessionStorageService } from "../services";

export const bearerZendeskTokenStrategy = (
  redisClientSelector: RedisClientSelectorType,
): passport.Strategy<passport.VerifyFunctionWithRequest> => {
  const options = {
    bodyName: "user_token",
    passReqToCallback: true,
    realm: "Proxy API",
    scope: "request",
  };
  return new passport.Strategy<passport.VerifyFunctionWithRequest>(
    options,
    (_: express.Request, token: string, done: StrategyDoneFunction) => {
      // tokens are hex string 2 chars = 1 byte
      const zendeskToken =
        token.length > SESSION_TOKEN_LENGTH_BYTES * 2
          ? token.substring(0, SESSION_TOKEN_LENGTH_BYTES * 2)
          : token;

      pipe(
        { redisClientSelector },
        RedisSessionStorageService.getByZendeskToken(
          zendeskToken as ZendeskToken,
        ),
      )().then(
        (errorOrUser: E.Either<Error, O.Option<User>>) => {
          try {
            fulfill(errorOrUser, done);
          } catch (e) {
            // The error is forwarded to the express error middleware
            done(e);
          }
        },
        () => {
          try {
            done(undefined, false);
          } catch (e) {
            // The error is forwarded to the express error middleware
            done(e);
          }
        },
      );
    },
  );
};
