import { describe, expect, it } from "vitest";
import {
  welcomeMessageContent,
  howToContent,
  cashbackContent,
} from "../welcome-messages";

describe("welcome messages", () => {
  it("should match snapshot", () => {
    expect(welcomeMessageContent.markdown).toMatchSnapshot();
    expect(welcomeMessageContent.subject).toMatchSnapshot();
    expect(howToContent.markdown).toMatchSnapshot();
    expect(howToContent.subject).toMatchSnapshot();
    expect(cashbackContent.markdown).toMatchSnapshot();
    expect(cashbackContent.subject).toMatchSnapshot();
  });
});
