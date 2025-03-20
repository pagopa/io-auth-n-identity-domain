import { describe, expect, it } from "vitest";
import * as htmlToTextUtils from "html-to-text";
import { HTML_TO_TEXT_OPTIONS } from "../../utils/email";

const htmlText = "Content";
const htmlTableContent = ["Foo", "Bar"];
const htmlContent = `<!doctype html>
<html lang="it">
  <head>
    <title>SAMPLE TITLE</title>
  </head>
  <body>
    <div>
      <h1>${htmlText}</h1>
      <!-- Based on selectors property, img elements should be skipped while moving to text format -->
      <img src="example.png"/>
      <table>
        <tr>
          <th>${htmlTableContent[0]}</th>
        </tr>
        <tr>
          <td>${htmlTableContent[1]}</td>
        </tr>
      </table>
    </div>
  </body>
</html>
`;

// By default in html-to-text lib, any heading is uppercased, in this case <h1>
// and <th>
const expectedHtmlToTextConversion =
  htmlText.toUpperCase() +
  `\n\n${htmlTableContent[0].toUpperCase()}\n${htmlTableContent[1]}`;

describe("regression testing", () => {
  it("should respect custom options", () => {
    const result = htmlToTextUtils.htmlToText(
      htmlContent,
      HTML_TO_TEXT_OPTIONS,
    );

    expect(result).toEqual(expectedHtmlToTextConversion);
  });
});
