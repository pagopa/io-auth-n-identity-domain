import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import * as HtmlToText from "html-to-text";
import * as NodeMailer from "nodemailer";

import { Context } from "@azure/functions";

import * as ai from "applicationinsights";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { EmailString } from "@pagopa/ts-commons/lib/strings";

import { sendMail } from "@pagopa/io-functions-commons/dist/src/mailer";
import { pipe } from "fp-ts/lib/function";
import * as mailvalidation from "@pagopa/io-app-email-templates/MailValidation/index";
import { createTracker } from "../utils/tracking";
import { EmailDefaults } from "../types/email";

// Activity input
export const ActivityInput = t.intersection([
  t.type({
    email: EmailString,
    token: t.string,
  }),
  // TODO: name field from partial to required after complete rollout of
  // IOPID-1444 task
  t.partial({ name: t.string }),
]);

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
const ActivityResultSuccess = t.type({
  kind: t.literal("SUCCESS"),
});

const ActivityResultFailure = t.type({
  kind: t.literal("FAILURE"),
  reason: t.string,
});

export const ActivityResult = t.union([
  ActivityResultSuccess,
  ActivityResultFailure,
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const getSendValidationEmailActivityHandler =
  (
    mailerTransporter: NodeMailer.Transporter,
    emailDefaults: EmailDefaults,
    functionsPublicUrl: string,
  ) =>
  async (context: Context, input: unknown): Promise<unknown> => {
    const logPrefix = "SendTemplatedValidationEmailActivity";

    const errorOrActivityInput = ActivityInput.decode(input);

    if (isLeft(errorOrActivityInput)) {
      context.log.error(
        `${logPrefix}|Error decoding input|ERROR=${readableReport(
          errorOrActivityInput.left,
        )}`,
      );
      return ActivityResultFailure.encode({
        kind: "FAILURE",
        reason: "Error decoding input",
      });
    }

    const activityInput = errorOrActivityInput.right;
    const { email, token, name } = activityInput;

    // Generate the email html from the template
    const { from, title, htmlToTextOptions } = emailDefaults;

    const emailHtml = mailvalidation.apply(
      title,
      `${functionsPublicUrl}/validate-profile-email?token=${token}`,
      name,
    );

    // converts the HTML to pure text to generate the text version of the message
    const emailText = HtmlToText.htmlToText(emailHtml, htmlToTextOptions);

    // Send email with the validation link
    await pipe(
      sendMail(mailerTransporter, {
        from,
        html: emailHtml,
        subject: title,
        text: emailText,
        to: email,
      }),
      TE.bimap(
        (e) => {
          const error = Error(
            `${logPrefix}|Error sending validation email|ERROR=${e.message}`,
          );
          context.log.error(error.message);
          throw error;
        },
        (result) => {
          const messageInfo = result.value;

          // on success, track a custom event with properties of transport used
          // see https://github.com/pagopa/io-functions-commons/blob/master/src/utils/nodemailer.ts
          // note: the extra properties will be defined only when using a MultiTransport
          createTracker(ai.defaultClient).profile.traceEmailValidationSend(
            typeof messageInfo === "object" ? messageInfo : {},
          );
        },
      ),
    )();

    return ActivityResultSuccess.encode({
      kind: "SUCCESS",
    });
  };
