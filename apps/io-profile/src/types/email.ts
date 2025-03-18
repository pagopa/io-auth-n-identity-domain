import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { HtmlToTextOptions } from "html-to-text";

export type EmailDefaults = {
  from: NonEmptyString;
  htmlToTextOptions: HtmlToTextOptions;
  title: string;
};
