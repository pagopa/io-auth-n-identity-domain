import { NextFunction, Request, Response } from "express";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { RedisSessionStorageService } from "../services";
import { RedisClientSelectorType } from "../types/redis";
import { SessionToken } from "../types/token";

export const CURRENT_USER_HEADER = "x-pagopa-current-user";

export const loginRouteSessionResolverMiddleware =
  (redisClientSelector: RedisClientSelectorType) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.path.endsWith("/login")) {
      return next();
    }

    const rawToken = req.header(CURRENT_USER_HEADER);
    if (!rawToken) {
      return next();
    }

    return await pipe(
      rawToken,
      SessionToken.decode,
      TE.fromEither,
      TE.chainW((token) =>
        RedisSessionStorageService.getBySessionToken({
          token,
          redisClientSelector,
        }),
      ),
      TE.map(
        // TODO: decide what to do if the session is not found
        O.map(({ fiscal_code }) => {
          if (fiscal_code) {
            res.locals.currentUser = fiscal_code;
          }
        }),
      ),
      TE.match(
        // TODO: decide what to do on error resolving session
        (err) => {
          console.warn("Error resolving session on /login:", err);
          next();
        },
        () => next(),
      ),
    )();
  };
