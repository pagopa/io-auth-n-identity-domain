/* eslint-disable @typescript-eslint/no-explicit-any */

import { EmailString } from "@pagopa/ts-commons/lib/strings";
import { describe, expect, it, vi } from "vitest";

import { apply } from "@pagopa/io-app-email-templates/MailValidation/index";
import { context as contextMock } from "../__mocks__/durable-functions";
import { aName } from "../__mocks__/mocks";
import {
  ActivityInput as SendValidationEmailActivityInput,
  getSendValidationEmailActivityHandler,
} from "../send-templated-validation-email-activity";
import { EmailDefaults } from "../../types/email";

const htmlAndTextContent = "CONTENT";

vi.mock("applicationinsights", () => ({
  defaultClient: {
    trackEvent: vi.fn(),
  },
}));

vi.mock("@pagopa/io-app-email-templates/MailValidation/index", () => ({
  apply: vi.fn(() => htmlAndTextContent),
}));

describe("SendTemplatedValidationEmailActivityHandler", () => {
  it("should send the email using the input data", async () => {
    const functionsPublicUrl = "https://publicUrl";
    const emailDefaults: EmailDefaults = {
      from: "from@example.com" as any,
      htmlToTextOptions: {},
      title: "Email title",
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
});
