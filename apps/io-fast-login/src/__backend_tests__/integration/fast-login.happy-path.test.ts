import { afterAll, beforeAll, describe, expect } from "vitest";
import {
  buildFastLoginSamlResponse,
  fastLoginFixture
} from "../support/fixtures";
import { FunctionHost } from "../support/function-host";
import { LollipopStub } from "../support/lollipop-stub";
import { backendTest as test } from "../support/with-test-fixtures";
import { callFastLogin, fastLoginExpectedStubPath } from "../support/scenarios";

describe("backend integration | fast-login", () => {
  const lollipopStub = new LollipopStub(buildFastLoginSamlResponse());
  let host!: FunctionHost;

  beforeAll(async () => {
    await lollipopStub.start();
    host = new FunctionHost({
      lollipopBaseUrl: lollipopStub.baseUrl
    });
    await host.start();
  }, 60_000);

  afterAll(async () => {
    await host.stop();
    await lollipopStub.stop();
  });

  test("returns the SAML response, deletes the nonce, writes the audit blob, and calls Lollipop", async ({
    backend
  }) => {
    await backend.seedFastLoginNonce(fastLoginFixture.nonce);

    const response = await callFastLogin(host);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      saml_response: buildFastLoginSamlResponse()
    });

    expect(
      await backend.findRedisKeysContaining(fastLoginFixture.nonce)
    ).toEqual([]);

    const auditBlobs = await backend.readAuditBlobs();
    const auditBlobBody = JSON.parse(auditBlobs[0].body) as {
      assertion_xml: string;
      client_ip: string;
      lollipop_request: {
        headers: Record<string, string>;
      };
    };
    const recordedRequest = lollipopStub.recordedRequests[0];

    expect(auditBlobs).toHaveLength(1);
    expect(auditBlobs[0].name).toMatch(
      new RegExp(`^${fastLoginFixture.userId}-`)
    );
    expect(auditBlobs[0].name).toContain(fastLoginFixture.assertionRef);

    expect(auditBlobBody.assertion_xml).toBe(buildFastLoginSamlResponse());
    expect(auditBlobBody.client_ip).toBe(fastLoginFixture.clientIp);
    expect(
      auditBlobBody.lollipop_request.headers["x-pagopa-lollipop-assertion-ref"]
    ).toBe(fastLoginFixture.assertionRef);
    expect(
      auditBlobBody.lollipop_request.headers["x-pagopa-lollipop-user-id"]
    ).toBe(fastLoginFixture.userId);

    expect(lollipopStub.recordedRequests).toHaveLength(1);
    expect(recordedRequest.method).toBe("GET");
    expect(recordedRequest.path).toBe(fastLoginExpectedStubPath);
    expect(recordedRequest.headers["ocp-apim-subscription-key"]).toBe(
      "io-fast-login-backend-tests-lollipop-api-key"
    );
    expect(recordedRequest.headers["x-pagopa-lollipop-auth"]).toBe(
      `Bearer ${fastLoginFixture.lollipopAuthJwt}`
    );
  });
});
