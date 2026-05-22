import { createServer, type Server } from "node:http";
import express from "express";

import {
  ASSERTION_REF,
  EXTENDED_PROFILE,
  FAST_LOGIN_SAML_RESPONSE,
  FISCAL_CODE,
} from "./fixtures";

type RecordedRequest = {
  readonly body?: unknown;
  readonly headers: Record<string, string | undefined>;
  readonly method: string;
  readonly path: string;
};

export type StubServerState = {
  readonly fastLoginRequests: ReadonlyArray<RecordedRequest>;
  readonly lollipopGenerateRequests: ReadonlyArray<RecordedRequest>;
  readonly platformDeleteSessionRequests: ReadonlyArray<RecordedRequest>;
  readonly profileRequests: ReadonlyArray<RecordedRequest>;
};

const getHeader = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const toRecordedRequest = (
  req: express.Request,
  headerNames: ReadonlyArray<string>,
): RecordedRequest => ({
  body: req.body,
  headers: Object.fromEntries(
    headerNames.map((headerName) => [headerName, getHeader(req.headers[headerName])]),
  ),
  method: req.method,
  path: req.path,
});

export const createStubServer = async () => {
  const app = express();
  const state = {
    fastLoginRequests: [] as RecordedRequest[],
    lollipopGenerateRequests: [] as RecordedRequest[],
    platformDeleteSessionRequests: [] as RecordedRequest[],
    profileRequests: [] as RecordedRequest[],
  };

  app.use(express.json());

  app.get("/api/v1/profiles/:fiscalCode", (req, res) => {
    state.profileRequests.push(toRecordedRequest(req, []));
    res.status(200).json({
      ...EXTENDED_PROFILE,
      fiscal_code: req.params.fiscalCode,
    });
  });

  app.delete("/sessions", (req, res) => {
    state.platformDeleteSessionRequests.push(
      toRecordedRequest(req, ["x-session-token"]),
    );
    res.status(204).end();
  });

  app.post("/api/v1/fast-login", (req, res) => {
    state.fastLoginRequests.push(
      toRecordedRequest(req, [
        "signature",
        "signature-input",
        "x-pagopa-lollipop-assertion-ref",
        "x-pagopa-lollipop-auth-jwt",
        "x-pagopa-lollipop-original-method",
        "x-pagopa-lollipop-original-url",
        "x-pagopa-lollipop-public-key",
        "x-pagopa-lollipop-user-id",
        "x-pagopa-lv-client-ip",
      ]),
    );
    res.status(200).json({
      saml_response: FAST_LOGIN_SAML_RESPONSE,
    });
  });

  app.post("/pubKeys/:assertionRef/generate", (req, res) => {
    state.lollipopGenerateRequests.push(
      toRecordedRequest(req, ["content-type"]),
    );
    res.status(200).json({
      assertion_file_name: `${FISCAL_CODE}-${ASSERTION_REF}`,
      assertion_ref: req.params.assertionRef,
      assertion_type: "SAML",
      expired_at: "2027-01-01T00:00:00.000Z",
      fiscal_code: FISCAL_CODE,
      lc_authentication_bearer: "a bearer token",
      pub_key: "a pub key",
      status: "VALID",
      ttl: 900,
      version: 1,
    });
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Cannot read stub server address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    getState: (): StubServerState => ({
      fastLoginRequests: state.fastLoginRequests,
      lollipopGenerateRequests: state.lollipopGenerateRequests,
      platformDeleteSessionRequests: state.platformDeleteSessionRequests,
      profileRequests: state.profileRequests,
    }),
    reset: () => {
      state.fastLoginRequests.length = 0;
      state.lollipopGenerateRequests.length = 0;
      state.platformDeleteSessionRequests.length = 0;
      state.profileRequests.length = 0;
    },
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
};
