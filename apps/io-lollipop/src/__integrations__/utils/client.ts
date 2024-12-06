export const ACTIVATE_PUB_KEY_PATH = "api/v1/pubkeys";
export const fetchActivatePubKey = (
  assertionRef: string,
  body: unknown,
  baseUrl: string,
  nodeFetch: typeof fetch
) =>
  nodeFetch(`${baseUrl}/${ACTIVATE_PUB_KEY_PATH}/${assertionRef}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

export const RESERVE_PUB_KEY_PATH = "api/v1/pubkeys";
export const fetchReservePubKey = (
  body: unknown,
  baseUrl: string,
  nodeFetch: typeof fetch
) =>
  nodeFetch(`${baseUrl}/${RESERVE_PUB_KEY_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

const GENERATE_LC_PARAMS_BASE_PATH = "api/v1/pubkeys";
export const fetchGenerateLcParams = (
  assertionRef: string,
  body: unknown,
  baseUrl: string,
  nodeFetch: typeof fetch
) =>
  nodeFetch(
    `${baseUrl}/${GENERATE_LC_PARAMS_BASE_PATH}/${assertionRef}/generate`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

export const GET_ASSERTION_BASE_PATH = "api/v1/assertions";
export const fetchGetAssertion = (
  assertionRef: string,
  jwtHeaderName: string,
  jwt: string | undefined,
  baseUrl: string,
  nodeFetch: typeof fetch
) =>
  nodeFetch(`${baseUrl}/${GET_ASSERTION_BASE_PATH}/${assertionRef}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(jwt !== undefined ? { [jwtHeaderName]: `Bearer ${jwt}` } : {})
    }
  });
