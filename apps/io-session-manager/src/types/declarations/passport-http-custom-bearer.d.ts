/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "passport-http-custom-bearer" {
  import passport = require("passport");
  import express = require("express");
  import koa = require("koa");

  interface IStrategyOptions {
    bodyName?: string;
    headerName?: string;
    queryName?: string;
    scope?: string | string[] | undefined;
    realm?: string | undefined;
    passReqToCallback?: boolean | undefined;
  }
  interface IVerifyOptions {
    message?: string | undefined;
    scope?: string | string[];
  }

  type VerifyFunction = (
    token: string,
    done: (error: any, user?: any, options?: IVerifyOptions | string) => void,
  ) => void;

  interface IKoaContextContainer {
    ctx: koa.Context;
  }
  type KoaPassportExpressRequestMock = Partial<express.Request> &
    IKoaContextContainer;

  type VerifyFunctionWithRequest = (
    req: express.Request,
    token: string,
    done: (error: any, user?: any, options?: IVerifyOptions | string) => void,
  ) => void;
  type VerifyFunctionWithContext = (
    req: KoaPassportExpressRequestMock,
    token: string,
    done: (error: any, user?: any, options?: IVerifyOptions | string) => void,
  ) => void;

  type VerifyFunctions =
    | VerifyFunction
    | VerifyFunctionWithRequest
    | VerifyFunctionWithContext;

  class Strategy<T extends VerifyFunctions> implements passport.Strategy {
    constructor(verify: VerifyFunction);
    constructor(options: IStrategyOptions, verify: T);

    name: string;
    authenticate(req: express.Request, options?: object): void;
  }
}
