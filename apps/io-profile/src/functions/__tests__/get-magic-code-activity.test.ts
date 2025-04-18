import { IPString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import { afterEach, describe, expect, it, vi } from "vitest";
import { context } from "../__mocks__/durable-functions";
import { aFiscalCode, anIPAddress } from "../__mocks__/mocks";
import {
  ActivityResultSuccess,
  getMagicCodeActivityHandler,
} from "../get-magic-code-activity";
import { MagicLinkServiceClient } from "../../utils/magic-code";

const aValidPayload = {
  family_name: "foo" as NonEmptyString,
  name: "foo" as NonEmptyString,
  fiscal_code: aFiscalCode,
};

const unknownIP = "UNKNOWN";

const aValidPayloadWithIPAddress = {
  ...aValidPayload,
  ip: anIPAddress as IPString,
};

const aValidMagicLink = "https://example.com/#token=abcde" as NonEmptyString;

const getMagicLinkTokenMock = vi
  .fn()
  .mockResolvedValue(
    E.right({ status: 200, value: { magic_link: aValidMagicLink } }),
  );

const mockMagicLinkServiceClient = {
  getMagicLinkToken: getMagicLinkTokenMock,
} as unknown as MagicLinkServiceClient;

afterEach(() => {
  getMagicLinkTokenMock.mockClear();
});

describe("GetMagicCodeActivity", () => {
  it("should return a success with a valid input", async () => {
    const result = await getMagicCodeActivityHandler(
      mockMagicLinkServiceClient,
    )(context as any, aValidPayloadWithIPAddress);

    expect(getMagicLinkTokenMock).toHaveBeenCalledTimes(1);
    expect(getMagicLinkTokenMock).toHaveBeenCalledWith({
      body: {
        family_name: aValidPayload.family_name,
        fiscal_number: aValidPayload.fiscal_code,
        name: aValidPayload.name,
        ip: aValidPayloadWithIPAddress.ip,
      },
    });
    expect(ActivityResultSuccess.is(result)).toEqual(true);
  });

  it("should return a success with a valid input even without IP", async () => {
    const result = await getMagicCodeActivityHandler(
      mockMagicLinkServiceClient,
    )(context as any, aValidPayload);

    expect(getMagicLinkTokenMock).toHaveBeenCalledTimes(1);
    expect(getMagicLinkTokenMock).toHaveBeenCalledWith({
      body: {
        family_name: aValidPayload.family_name,
        fiscal_number: aValidPayload.fiscal_code,
        name: aValidPayload.name,
        ip: unknownIP,
      },
    });
    expect(ActivityResultSuccess.is(result)).toEqual(true);
  });

  it("should return a FAILURE when the service could not be reached via network", async () => {
    const error = "an error";
    getMagicLinkTokenMock.mockRejectedValueOnce(error);

    const result = await getMagicCodeActivityHandler(
      mockMagicLinkServiceClient,
    )(context as any, aValidPayload);

    expect(ActivityResultSuccess.is(result)).toEqual(false);
    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: `Error while calling magic link service: ${error}`,
    });
  });

  it("should return a FAILURE when the service gives an unexpected response", async () => {
    getMagicLinkTokenMock.mockResolvedValueOnce(E.left([]));

    const result = await getMagicCodeActivityHandler(
      mockMagicLinkServiceClient,
    )(context as any, aValidPayload);

    expect(ActivityResultSuccess.is(result)).toEqual(false);
    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: expect.stringContaining(
        "magic link service returned an unexpected response:",
      ),
    });
  });

  it("should return a FAILURE when the service gives a status code different from 200", async () => {
    getMagicLinkTokenMock.mockResolvedValueOnce(E.right({ status: 500 }));

    const result = await getMagicCodeActivityHandler(
      mockMagicLinkServiceClient,
    )(context as any, aValidPayload);

    expect(ActivityResultSuccess.is(result)).toEqual(false);
    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: "magic link service returned 500",
    });
  });

  it("should return a FAILURE when the input is not valid", async () => {
    const result = await getMagicCodeActivityHandler(
      mockMagicLinkServiceClient,
    )(context as any, {});

    expect(ActivityResultSuccess.is(result)).toEqual(false);
    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: "Error while decoding input",
    });
  });
});
