/* eslint-disable @typescript-eslint/no-explicit-any */

import { apply } from "@pagopa/io-app-email-templates/MailValidation/index";
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { describe, expect, it, vi } from "vitest";
import { EmailDefaults } from "../../types/email";
import { HTML_TO_TEXT_OPTIONS } from "../../utils/email";
import { context as contextMock } from "../__mocks__/durable-functions";
import { aName } from "../__mocks__/mocks";
import {
  ActivityInput as SendValidationEmailActivityInput,
  getSendValidationEmailActivityHandler,
} from "../send-templated-validation-email-activity";

const htmlAndTextContent = "CONTENT";

vi.mock("applicationinsights", () => ({
  defaultClient: {
    trackEvent: vi.fn(),
  },
}));

vi.mock("@pagopa/io-app-email-templates/MailValidation/index", () => ({
  apply: vi.fn(() => htmlAndTextContent),
}));

const getIoWebBaseUrl = () =>
  pipe(
    "https://iowebBaseUrl",
    UrlFromString.decode,
    E.getOrElseW(() => {
      throw new Error("Cannot decode ioweb base url");
    }),
  );

describe("SendTemplatedValidationEmailActivityHandler", () => {
  it("should send the email using the input data", async () => {
    const functionsPublicUrl = "https://publicUrl";
    const iowebBaseUrl = getIoWebBaseUrl();
    const emailDefaults: EmailDefaults = {
      from: "from@example.com" as NonEmptyString,
      htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
      title: "Email title" as NonEmptyString,
    };
    const mailerTransporterMock = {
      sendMail: vi.fn((_, f) => {
        f(undefined, {});
      }),
    };

    const handler = getSendValidationEmailActivityHandler(
      mailerTransporterMock as any,
      emailDefaults,
      functionsPublicUrl,
      iowebBaseUrl,
      false,
    );

    const input = SendValidationEmailActivityInput.encode({
      email: "email@example.com" as EmailString,
      token: "FAKE_TOKEN",
      name: aName,
    });

    await handler(contextMock as any, input);

    expect(apply).toBeCalledWith(
      emailDefaults.title,
      `${functionsPublicUrl}/validate-profile-email?token=${input.token}`,
      aName,
    );
    expect(mailerTransporterMock.sendMail).toHaveBeenCalledWith(
      {
        from: emailDefaults.from,
        html: htmlAndTextContent,
        subject: emailDefaults.title,
        text: htmlAndTextContent,
        to: input.email,
      },
      expect.any(Function),
    );
  });

  it("should send the email including ioweb url when FF is enabled", async () => {
    const functionsPublicUrl = "https://publicUrl";
    const iowebBaseUrl = getIoWebBaseUrl();
    const emailDefaults: EmailDefaults = {
      from: "from@example.com" as NonEmptyString,
      htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
      title: "Email title" as NonEmptyString,
    };
    const mailerTransporterMock = {
      sendMail: vi.fn((_, f) => {
        f(undefined, {});
      }),
    };

    const handler = getSendValidationEmailActivityHandler(
      mailerTransporterMock as any,
      emailDefaults,
      functionsPublicUrl,
      iowebBaseUrl,
      true,
    );

    const input = SendValidationEmailActivityInput.encode({
      email: "email@example.com" as EmailString,
      token: "FAKE_TOKEN",
      name: aName,
    });

    await handler(contextMock as any, input);

    // ValidUrl.href includes the trailing slash
    expect(apply).toBeCalledWith(
      emailDefaults.title,
      `${iowebBaseUrl.href}it/conferma-email/?token=${input.token}`,
      aName,
    );
    expect(mailerTransporterMock.sendMail).toHaveBeenCalledWith(
      {
        from: emailDefaults.from,
        html: htmlAndTextContent,
        subject: emailDefaults.title,
        text: htmlAndTextContent,
        to: input.email,
      },
      expect.any(Function),
    );
  });
});
