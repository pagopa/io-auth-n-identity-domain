import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export type EmailDefaults = {
  from: NonEmptyString;
  htmlToTextOptions: HtmlToTextOptions;
  title: string;
};
