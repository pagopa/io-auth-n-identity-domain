import {
  buildFastLoginHeaders,
  fastLoginFixture,
  generateNonceScenarioName
} from "./fixtures";
import type { FunctionHost } from "./function-host";

export type HttpCallResult = {
  readonly body: unknown;
  readonly request: {
    readonly body?: unknown;
    readonly headers: Record<string, string>;
    readonly method: string;
    readonly path: string;
  };
  readonly status: number;
};

const jsonRequest = async (
  host: FunctionHost,
  path: string,
  options: {
    readonly body?: unknown;
    readonly headers?: Record<string, string>;
    readonly method: "GET" | "POST";
  }
): Promise<HttpCallResult> => {
  const headers = {
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(options.headers ?? {}),
    "x-functions-key": host.xFunctionsKey
  };
  const response = await fetch(`${host.baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method
  });

  return {
    body: (await response.json()) as unknown,
    request: {
      body: options.body,
      headers,
      method: options.method,
      path
    },
    status: response.status
  };
};

export const callGenerateNonce = async (
  host: FunctionHost
): Promise<HttpCallResult> =>
  jsonRequest(host, "/api/v1/nonce/generate", {
    method: "POST"
  });

export const callFastLogin = async (
  host: FunctionHost
): Promise<HttpCallResult> =>
  jsonRequest(host, "/api/v1/fast-login", {
    headers: buildFastLoginHeaders(),
    method: "POST"
  });

export const generateNonceScenarioLabel = generateNonceScenarioName;

export const fastLoginExpectedStubPath = `//lollipop/api/v1/assertions/${fastLoginFixture.assertionRef}`;
