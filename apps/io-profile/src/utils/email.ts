import { HtmlToTextOptions } from "html-to-text";

export const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  selectors: [{ selector: "img", format: "skip" }], // Ignore all document images
  tables: true,
};
