import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { HtmlToTextOptions } from "html-to-text";

export const EXPIRED_SESSION_EMAIL_TITLE: NonEmptyString = "TODO: Add email title here" as NonEmptyString; // TODO: Aggiungiamo come configurazione?

export const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  selectors: [{ selector: "img", format: "skip" }], // Ignore all document images
  tables: true
};

export interface MailBody {
  readonly emailHtml: string;
  readonly emailText: string;
}

export interface EmailParameters {
  readonly from: NonEmptyString;
  readonly htmlToTextOptions: HtmlToTextOptions;
  readonly title: NonEmptyString;
}

export type MailerTransporterDependency = {
  readonly mailerTransporter: ReturnType<typeof getMailerTransporter>;
};
