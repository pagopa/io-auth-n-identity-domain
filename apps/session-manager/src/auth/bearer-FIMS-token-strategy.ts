/**
 * Builds and configure a Passport strategy to authenticate the proxy clients.
 */

import * as express from "express";
import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import * as passport from "passport-http-bearer";
import { pipe } from "fp-ts/lib/function";
import { FIMSToken } from "../types/token";
import { User } from "../types/user";
import { RedisClientSelectorType } from "../types/redis";
import { getByFIMSToken } from "../services/redis-session-storage";
import { fulfill, StrategyDoneFunction } from "../utils/strategies";

const bearerFIMSTokenStrategy = (
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
      pipe({ redisClientSelector }, getByFIMSToken(token as FIMSToken))().then(
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

export default bearerFIMSTokenStrategy;
