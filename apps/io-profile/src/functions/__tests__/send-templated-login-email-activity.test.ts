import * as fallbackMailTemplate from "@pagopa/io-app-email-templates/LoginNotification/index";
import * as mailTemplate from "@pagopa/io-app-email-templates/LoginNotificationIOWeb/index";
import {
  EmailString,
  IPString,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import * as ai from "applicationinsights";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { context } from "../__mocks__/durable-functions";
import {
  ActivityInput,
  getSendLoginEmailActivityHandler,
} from "../send-templated-login-email-activity";
import { EmailDefaults } from "../../types/email";
import { HTML_TO_TEXT_OPTIONS } from "../../utils/email";

const aDate = new Date("1970-01-01");
const aValidPayload: ActivityInput = {
  date_time: aDate,
  name: "foo" as NonEmptyString,
  email: "example@example.com" as EmailString,
  identity_provider: "idp" as NonEmptyString,
  ip_address: "127.0.0.1" as IPString,
};
const aValidPayloadWithMagicLink: ActivityInput = {
  ...aValidPayload,
  magic_link: "http://example.com/#token=abcde" as NonEmptyString,
};
const emailDefaults: EmailDefaults = {
  from: "from@example.com" as NonEmptyString,
  htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
  title: "Email title" as NonEmptyString,
};

const mockMailerTransporter = {
  sendMail: vi.fn((_, f) => {
    f(undefined, {});
  }),
};

const anAccessRef = { href: "https://website.it" } as ValidUrl;

const mockTrackEvent = vi.fn();
const mockTracker = {
  trackEvent: mockTrackEvent,
} as unknown as ai.TelemetryClient;

const templateFunction = vi.spyOn(mailTemplate, "apply");
const fallbackTemplateFunction = vi.spyOn(fallbackMailTemplate, "apply");

describe("SendTemplatedLoginEmailActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    title                     | payload
    ${"fallback login email"} | ${aValidPayload}
    ${"login email"}          | ${aValidPayloadWithMagicLink}
  `("should send a $title with the data", async ({ payload }) => {
    const handler = getSendLoginEmailActivityHandler(
      mockMailerTransporter as any,
      emailDefaults,
      anAccessRef,
      mockTracker,
    );

    const result = await handler(context as any, payload);

    expect(result.kind).toEqual("SUCCESS");
    expect(templateFunction).toHaveBeenCalledTimes(payload.magic_link ? 1 : 0);
    expect(fallbackTemplateFunction).toHaveBeenCalledTimes(
      payload.magic_link ? 0 : 1,
    );
    expect(mockMailerTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(mockMailerTransporter.sendMail).toHaveBeenCalledWith(
      {
        from: emailDefaults.from,
        html: expect.any(String),
        subject: emailDefaults.title,
        text: expect.any(String),
        to: aValidPayload.email,
      },
      expect.any(Function),
    );
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it("should fail given wrong payload", async () => {
    const handler = getSendLoginEmailActivityHandler(
      mockMailerTransporter as any,
      emailDefaults,
      anAccessRef,
      mockTracker,
    );

    const result = await handler(context as any, {
      ...aValidPayload,
      email: "wrong!",
    });

    expect(result.kind).toEqual("FAILURE");
    expect(mockMailerTransporter.sendMail).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
