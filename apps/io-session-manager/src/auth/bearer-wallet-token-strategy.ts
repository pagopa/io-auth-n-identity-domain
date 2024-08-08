/**
 * Builds and configure a Passport strategy to authenticate the proxy clients.
 */

import * as express from "express";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as passport from "passport-http-bearer";
import { pipe } from "fp-ts/function";
import { WalletToken } from "../types/token";
import { User } from "../types/user";
import { fulfill, StrategyDoneFunction } from "../utils/strategies";
import { RedisClientSelectorType } from "../types/redis";
import { RedisSessionStorageService } from "../services";

export const bearerWalletTokenStrategy = (
  redisClientSelector: RedisClientSelectorType,
): passport.Strategy<passport.VerifyFunctionWithRequest> => {
  const options = {
    passReqToCallback: true,
    realm: "Proxy API",
    scope: "request",
  };
  return new passport.Strategy<passport.VerifyFunctionWithRequest>(
    options,
    (_: express.Request, token: string, done: StrategyDoneFunction) => {
      pipe(
        { redisClientSelector },
        RedisSessionStorageService.getByWalletToken(token as WalletToken),
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
