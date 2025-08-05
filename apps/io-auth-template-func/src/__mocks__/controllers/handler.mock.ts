import * as H from "@pagopa/handler-kit";
import * as L from "@pagopa/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const httpHandlerInputMocks: H.HandlerEnvironment<H.HttpRequest> = {
  input: H.request("mockurl"),
  inputDecoder: H.HttpRequest,
  logger: {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    log: () => () => {},
    format: L.format.simple,
  },
};
