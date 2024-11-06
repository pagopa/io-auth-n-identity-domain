import * as H from "@pagopa/handler-kit";

export const CustomHttpUnauthorizedError = class extends H.HttpError {
  public readonly status = 401 as const;
  public readonly title = "Unauthorized";
};

export const errorToHttpError = (error: Error): H.HttpError =>
  new H.HttpError(`Internal Server Error: ${error.message}`);
