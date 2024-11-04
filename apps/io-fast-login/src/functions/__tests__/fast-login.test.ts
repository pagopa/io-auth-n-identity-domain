import { makeFastLoginHandler } from "../fast-login";
import * as H from "@pagopa/handler-kit";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import * as E from "fp-ts/Either";
import { FnLollipopClient } from "../../utils/lollipop/dependency";
import {
  aLollipopInvalidSignature,
  aNonce,
  aSAMLResponse,
  validFastLoginAdditionalHeaders,
  validLollipopHeaders
} from "../__mocks__/lollipopMocks";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { BlobService } from "azure-storage";
import * as O from "fp-ts/Option";
import * as azureStorage from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import { aFiscalCode, anotherFiscalCode } from "../__mocks__/general";
import * as TE from "fp-ts/lib/TaskEither";
import * as mattrglobalUtils from "@mattrglobal/http-signatures/lib/verify/verifySignatureHeader";
import { okAsync, errAsync } from "neverthrow";
import { prefixer } from "../../model/nonce";
import { mockRedisClientTask, mockDel } from "../__mocks__/redis";

const getAssertionMock = jest.fn(async () =>
  E.right({
    status: 200,
    value: { response_xml: aSAMLResponse }
  })
);
const mockedFnLollipopClient = ({
  getAssertion: getAssertionMock
} as unknown) as FnLollipopClient;
const mockBlobService = ({} as unknown) as BlobService;
const mockUpsertBlobFromObject = jest
  .spyOn(azureStorage, "upsertBlobFromObject")
  .mockResolvedValue(
    E.right(
      O.some({
        created: true
      } as any)
    )
  );

const mockValidateSignature = jest
  .spyOn(mattrglobalUtils, "verifySignatureHeader")
  .mockResolvedValue(okAsync({ verified: true }));

describe("Fast Login handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it(`GIVEN a valid LolliPoP request
      WHEN all checks passed
      THEN the SAMLResponse is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ...validFastLoginAdditionalHeaders
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalledWith(prefixer(aNonce));
    expect(getAssertionMock).toBeCalled();
    expect(mockUpsertBlobFromObject).toBeCalled();
    expect(mockUpsertBlobFromObject).toBeCalledWith(
      {},
      "logs",
      // Check that the audit log filename starts with the fiscal code
      expect.stringMatching(
        new RegExp(`^${validLollipopHeaders["x-pagopa-lollipop-user-id"]}-?`)
      ),
      expect.objectContaining({
        assertion_xml: aSAMLResponse,
        client_ip: validFastLoginAdditionalHeaders["x-pagopa-lv-client-ip"],
        lollipop_request: {
          headers: expect.objectContaining(validLollipopHeaders)
        }
      })
    );
    expect(result).toEqual(
      E.right(
        expect.objectContaining({
          body: { saml_response: aSAMLResponse },
          statusCode: 200
        })
      )
    );
  });

  it(`GIVEN a LolliPoP request
      WHEN the user client IP is invalid
      THEN a Bad Request error response is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ["x-pagopa-lv-client-ip"]: "Invalid Client IP value"
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).not.toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toBeCalled();
    expect(mockUpsertBlobFromObject).not.toBeCalled();
    expect(result).toMatchObject(
      E.right({
        statusCode: 400,
        body: {
          status: 400,
          title: "Missing or invalid LolliPoP Headers"
        }
      })
    );
  });

  it(`GIVEN a LolliPoP request
      WHEN the user client IP is missing
      THEN a Bad Request error response is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: validLollipopHeaders
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).not.toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toBeCalled();
    expect(mockUpsertBlobFromObject).not.toBeCalled();
    expect(result).toMatchObject(
      E.right({
        statusCode: 400,
        body: {
          status: 400,
          title: "Missing or invalid LolliPoP Headers"
        }
      })
    );
  });

  it(`GIVEN a invalid LolliPoP request
      WHEN all the required headers are missing
      THEN a Bad Request error response is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        "x-wrong-header": "sub-that-does-not-exists"
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).not.toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toBeCalled();
    expect(mockUpsertBlobFromObject).not.toBeCalled();
    expect(result).toMatchObject(
      E.right({
        statusCode: 400,
        body: {
          status: 400,
          title: "Missing or invalid LolliPoP Headers"
        }
      })
    );
  });
  it(`GIVEN a invalid LolliPoP request
      WHEN some required header is invalid
      THEN a Bad Request error response is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ["x-pagopa-lollipop-assertion-ref"]: "anInvalidAssertionRef",
        ...validFastLoginAdditionalHeaders
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(mockValidateSignature).not.toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toBeCalled();
    expect(mockUpsertBlobFromObject).not.toBeCalled();
    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        statusCode: 400,
        body: {
          status: 400,
          title: "Missing or invalid LolliPoP Headers"
        }
      });
    }
  });
  it(`GIVEN a invalid LolliPoP request
      WHEN the signature is invalid
      THEN a Unauthorize Request error response is returned`, async () => {
    mockValidateSignature.mockResolvedValueOnce(
      errAsync({ type: "Error", message: "" })
    );
    mockValidateSignature.mockResolvedValueOnce(
      errAsync({ type: "Error", message: "" })
    );
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ["signature"]: aLollipopInvalidSignature,
        ...validFastLoginAdditionalHeaders
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(mockValidateSignature).toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toBeCalled();
    expect(mockUpsertBlobFromObject).not.toBeCalled();
    expect(result).toMatchObject(
      E.right({
        statusCode: 401,
        body: {
          status: 401,
          title: "Invalid Lollipop Signature"
        }
      })
    );
  });
  it(`GIVEN a valid LolliPoP request
      WHEN the fiscal code doesn't match with the SAML Assertion value
      THEN an Internal Server Error response is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ["x-pagopa-lollipop-user-id"]: anotherFiscalCode,
        ...validFastLoginAdditionalHeaders
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalledWith(prefixer(aNonce));
    expect(getAssertionMock).toBeCalled();
    expect(result).toMatchObject(
      E.right({
        statusCode: 500,
        body: {
          status: 500,
          title: `The provided user id do not match the fiscalNumber in the assertion: fromSaml=${aFiscalCode},fromHeader=${anotherFiscalCode}`
        }
      })
    );
  });
  it.each`
    WHEN                                               | getAssertion                                                                                                            | expectedErrorMessage
    ${"the fn-lolliop return an OIDC claim"}           | ${() => Promise.resolve(E.right({ status: 200, value: { id_token: "OidcSignedJwt", claims_token: "OidcSignedJwt" } }))} | ${"OIDC Claims not supported yet."}
    ${"the fn-lolliop return an error"}                | ${() => Promise.resolve(E.right({ status: 500, value: "" }))}                                                           | ${"Error retrieving the SAML Assertion"}
    ${"the fn-lollipop return an unexpected response"} | ${() => Promise.resolve(NonEmptyString.decode(""))}                                                                     | ${"Unexpected response from fn-lollipop"}
    ${"the fn-lolliop client throw an error"}          | ${() => Promise.reject(new Error("anError"))}                                                                           | ${"Error calling the getAssertion endpoint"}
  `(
    `GIVEN a valid LolliPoP request
     WHEN $WHEN
     THEN an Internal Server Error response is returned`,
    async ({ getAssertion, expectedErrorMessage }) => {
      const req: H.HttpRequest = {
        ...H.request("https://api.test.it/"),
        headers: {
          ...validLollipopHeaders,
          ...validFastLoginAdditionalHeaders
        }
      };
      getAssertionMock.mockImplementationOnce(getAssertion);
      const result = await makeFastLoginHandler({
        ...httpHandlerInputMocks,
        input: req,
        fnLollipopClient: mockedFnLollipopClient,
        blobService: mockBlobService,
        redisClientTask: mockRedisClientTask
      })();
      expect(mockValidateSignature).toHaveBeenCalled();
      expect(mockDel).toHaveBeenCalled();
      expect(mockDel).toHaveBeenCalledWith(prefixer(aNonce));
      expect(getAssertionMock).toBeCalled();
      expect(mockUpsertBlobFromObject).not.toBeCalled();
      expect(result).toMatchObject(
        E.right({
          statusCode: 500,
          body: { status: 500, title: expectedErrorMessage }
        })
      );
    }
  );

  it.each`
    WHEN                                      | upsertBlobFromObjectResult                    | expectedErrorMessage                                                 | resolve
    ${"the blob storage returns no result"}   | ${E.right(O.none)}                            | ${"The audit log was not saved"}                                     | ${true}
    ${"the blob sorage returns an error"}     | ${E.left(new Error("Storage Error Message"))} | ${"An error occurred saving the audit log: [Storage Error Message]"} | ${true}
    ${"the blob sorage unexpectedly rejects"} | ${new Error("Unexpected error")}              | ${"Unexpected error: [Unexpected error]"}                            | ${false}
  `(
    `GIVEN a valid LolliPoP request
     WHEN $WHEN
     THEN an Internal Server Error response is returned`,
    async ({ upsertBlobFromObjectResult, expectedErrorMessage, resolve }) => {
      resolve
        ? mockUpsertBlobFromObject.mockResolvedValueOnce(
            upsertBlobFromObjectResult
          )
        : mockUpsertBlobFromObject.mockRejectedValueOnce(
            upsertBlobFromObjectResult
          );
      const req: H.HttpRequest = {
        ...H.request("https://api.test.it/"),
        headers: {
          ...validLollipopHeaders,
          ...validFastLoginAdditionalHeaders
        }
      };
      const result = await makeFastLoginHandler({
        ...httpHandlerInputMocks,
        input: req,
        fnLollipopClient: mockedFnLollipopClient,
        blobService: mockBlobService,
        redisClientTask: mockRedisClientTask
      })();
      expect(mockValidateSignature).toHaveBeenCalled();
      expect(mockDel).toHaveBeenCalled();
      expect(mockDel).toHaveBeenCalledWith(prefixer(aNonce));
      expect(getAssertionMock).toBeCalled();
      expect(mockUpsertBlobFromObject).toBeCalled();
      expect(mockUpsertBlobFromObject).toBeCalledWith(
        {},
        "logs",
        expect.stringMatching(
          new RegExp(`^${validLollipopHeaders["x-pagopa-lollipop-user-id"]}-?`)
        ),
        expect.objectContaining({
          assertion_xml: aSAMLResponse,
          client_ip: validFastLoginAdditionalHeaders["x-pagopa-lv-client-ip"]
        })
      );
      expect(result).toEqual(
        E.right(
          expect.objectContaining({
            statusCode: 500,
            body: expect.objectContaining({
              title: expectedErrorMessage,
              status: 500
            })
          })
        )
      );
    }
  );

  it(`GIVEN a valid LolliPoP request 
      WHEN the nonce is missing 
      THEN an unauthorized error is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ...validFastLoginAdditionalHeaders,
        // even if we are not including a new signature header,
        // the validation below is still passing because
        // the method is mocked above with a jest.spyOn
        ["signature-input"]: `sig1=("x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url");created=1698315748;alg="ecdsa-p256-sha256";keyid="iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU"`
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(result).toEqual(
      E.right(
        expect.objectContaining({
          statusCode: 401,
          body: expect.objectContaining({
            title:
              "Invalid or missing nonce in request: [Could not retrieve nonce from signature-input.]",
            status: 401
          })
        })
      )
    );
  });

  it(`GIVEN a valid LolliPoP request 
      WHEN the nonce decode fails 
      THEN an unauthorized error is returned`, async () => {
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ...validFastLoginAdditionalHeaders,
        // even if we are not including a new signature header,
        // the validation below is still passing because
        // the method is mocked above with a jest.spyOn
        ["signature-input"]: `sig1=("x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url");created=1698315748;nonce="WRONG-NONCE";alg="ecdsa-p256-sha256";keyid="iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU"`
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(result).toEqual(
      E.right(
        expect.objectContaining({
          statusCode: 401,
          body: expect.objectContaining({
            title: expect.stringContaining("Error while decoding nonce:"),
            status: 401
          })
        })
      )
    );
  });

  it(`GIVEN an valid LolliPoP request 
    WHEN the nonce delete fails because of redis connection error 
    THEN an internal error is returned`, async () => {
    const anError = "dbError";
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ...validFastLoginAdditionalHeaders
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: TE.left(new Error(anError))
    })();
    expect(mockValidateSignature).toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(result).toEqual(
      E.right(
        expect.objectContaining({
          statusCode: 500,
          body: expect.objectContaining({
            title: `Internal Server Error: ${anError}`,
            status: 500
          })
        })
      )
    );
  });

  it(`GIVEN an valid LolliPoP request 
    WHEN the nonce delete fails because the key was not found
    THEN an unauthorized error is returned`, async () => {
    mockDel.mockResolvedValueOnce(0);
    const req: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      headers: {
        ...validLollipopHeaders,
        ...validFastLoginAdditionalHeaders
      }
    };
    const result = await makeFastLoginHandler({
      ...httpHandlerInputMocks,
      input: req,
      fnLollipopClient: mockedFnLollipopClient,
      blobService: mockBlobService,
      redisClientTask: mockRedisClientTask
    })();
    expect(mockValidateSignature).toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(mockUpsertBlobFromObject).not.toHaveBeenCalled();
    expect(result).toEqual(
      E.right(
        expect.objectContaining({
          statusCode: 401,
          body: expect.objectContaining({
            title: `Could not delete nonce: [Unexpected response from redis client: Deleted 0 keys]`,
            status: 401
          })
        })
      )
    );
  });
});
