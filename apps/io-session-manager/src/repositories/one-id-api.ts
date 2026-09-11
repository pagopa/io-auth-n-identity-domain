import * as nodeFetch from "node-fetch";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const SAML_ASSERTION_PATH = "/saml/assertion";

/**
 * Client for ONE Identity API built with plain `fetch`, as an alternative to
 * the codegen-based for the lack of application/xml response parse.
 * It only exposes the operations actually needed by consumers, with a
 * simplified interface.
 */
export function getOneIdAPIClient(
  // TODO: customize fetch with timeout
  fetchApi: typeof fetch = nodeFetch as unknown as typeof fetch,
) {
  /**
   * Retrieve the SAML assertion associated to the given access token.
   * The endpoint responds with a `application/xml` payload which is
   * returned as raw XML string to the caller. baseURL of the issuer is passed
   * as an argument to prevent multiple clients to be instantiated
   */
  const getSamlAssertion = (
    baseUrl: string,
    accessToken: NonEmptyString,
  ): TE.TaskEither<Error, string> =>
    pipe(
      TE.tryCatch(
        () =>
          fetchApi(
            `${baseUrl}${SAML_ASSERTION_PATH}?${new URLSearchParams({
              access_token: accessToken,
            }).toString()}`,
            {
              method: "GET",
              headers: { Accept: "application/xml" },
            },
          ),
        E.toError,
      ),
      TE.chain((response) => {
        if (!response.ok) {
          return TE.left(
            new Error(
              `Error calling ${SAML_ASSERTION_PATH} endpoint: received status ${response.status}`,
            ),
          );
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/xml")) {
          return TE.left(
            new Error(
              `Unexpected content-type received from ${SAML_ASSERTION_PATH} endpoint: expected "application/xml", received "${contentType}"`,
            ),
          );
        }

        return TE.tryCatch(() => response.text(), E.toError);
      }),
    );

  return {
    getSamlAssertion,
  };
}

export type OneIdAPIClient = ReturnType<typeof getOneIdAPIClient>;

export type OneIdAPIRepositoryDeps = {
  oneIdAPIClient: OneIdAPIClient;
};
