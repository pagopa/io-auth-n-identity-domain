import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";

export type MailerTransporterDependency = {
  readonly mailerTransporter: ReturnType<typeof getMailerTransporter>;
};
