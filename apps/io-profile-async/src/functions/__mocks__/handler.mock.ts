import * as H from "@pagopa/handler-kit";
import * as L from "@pagopa/logger";
import * as t from "io-ts";
export const httpHandlerInputMocks: H.HandlerEnvironment<t.TypeOf<
  typeof H.HttpRequest
>> = {
  input: H.request("mockurl"),
  inputDecoder: H.HttpRequest,
  logger: {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    log: () => () => {},
    format: L.format.simple
  }
};

export const mockQueueHandlerInputMocks = <A>(
  decoder: t.Decoder<unknown, A>,
  input: A
): H.HandlerEnvironment<A> => ({
  input,
  inputDecoder: decoder,
  logger: {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    log: () => () => {},
    format: L.format.simple
  }
});
