import * as H from "@pagopa/handler-kit";
import * as L from "@pagopa/logger";
import * as t from "io-ts";
export const httpHandlerInputMocks: H.HandlerEnvironment<t.TypeOf<
  typeof H.HttpRequest
>> = {
  input: H.request("mockurl"),
  inputDecoder: H.HttpRequest,
  logger: {
    log: () => () => {},
    format: L.format.simple
  }
};
