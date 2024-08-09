/**
 * Builds and configure a Passport strategy to authenticate the proxy clients.
 */

import * as express from "express";
import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import * as passport from "passport-http-bearer";
import { pipe } from "fp-ts/function";
import { BPDToken } from "../types/token";
import { User } from "../types/user";
import { fulfill, StrategyDoneFunction } from "../utils/strategies";
import { RedisClientSelectorType } from "../types/redis";
import { RedisSessionStorageService } from "../services";

export const bearerBPDTokenStrategy = (
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
        RedisSessionStorageService.getByBPDToken(token as BPDToken),
      )().then(
        (errorOrUser: Either<Error, Option<User>>) => {
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
