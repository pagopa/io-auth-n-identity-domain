import { Context } from "@azure/functions";
import { IProfileEmailReader } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aFiscalCode, aRetrievedProfileWithEmail } from "../__mocks__/mocks";
import {
  createMockProfileAsyncIterator,
  createMockProfileAsyncIteratorWithErrors,
  createProfileVersion,
} from "../__mocks__/mocks.profiles";
import { GetProfileVersionsHandler } from "../get-profile-versions";

type ProfileModelMock = {
  getQueryIterator: ReturnType<typeof vi.fn>;
};

// Date returns a timestamp expressed in milliseconds
const aTimestamp = Math.floor(new Date().valueOf() / 1000);
const anEmailOptOutEmailSwitchDate = new Date(aTimestamp * 1000);

// Helper per generare profili email mock
function generateProfileEmails(count: number, shouldThrow: boolean = false) {
  return () => {
    if (shouldThrow) {
      throw new Error("Error checking email uniqueness");
    }
    return Promise.resolve(
      Array.from({ length: count }, (_, i) => ({
        email: `test${i}@example.com`,
      })),
    );
  };
}

const profileEmailReader: IProfileEmailReader = {
  list: vi.fn(generateProfileEmails(7)),
};

const mockContext = {
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
} as unknown as Context;

// Helper to create a properly mocked ProfileModel
const createProfileModelMock = (): ProfileModelMock => ({
  getQueryIterator: vi.fn(),
});

// eslint-disable-next-line max-lines-per-function
describe("GetProfileVersionsHandler", () => {
  const FISCAL_CODE_PARAM = "@fiscalCode";
  const TEST_EMAIL = "test@example.com";

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-mock profileEmailReader.list after clearing
    profileEmailReader.list = vi.fn(generateProfileEmails(7));
  });

  describe("Pagination", () => {
    it("should return paginated profile versions with default page and pageSize", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 3, 30),
        createProfileVersion(aRetrievedProfileWithEmail, 2, 20),
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(profileModelMock.getQueryIterator).toHaveBeenCalledWith({
        parameters: [
          { name: FISCAL_CODE_PARAM, value: aFiscalCode },
          { name: "@offset", value: 0 },
          { name: "@limit", value: 25 },
        ],
        query: expect.stringContaining(
          "SELECT * FROM p WHERE p.fiscalCode = @fiscalCode ORDER BY p._ts DESC OFFSET @offset LIMIT @limit",
        ),
      });
      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items).toHaveLength(3);
        expect(response.value.page).toBe(1);
        expect(response.value.page_size).toBe(25);
        expect(response.value.has_more).toBe(false);
      }
    });

    it("should return paginated profile versions with custom page and pageSize", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 5, 50),
        createProfileVersion(aRetrievedProfileWithEmail, 4, 40),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(
        mockContext,
        aFiscalCode,
        O.some(2),
        O.some(2),
      );

      expect(profileModelMock.getQueryIterator).toHaveBeenCalledWith({
        parameters: [
          { name: FISCAL_CODE_PARAM, value: aFiscalCode },
          { name: "@offset", value: 2 },
          { name: "@limit", value: 2 },
        ],
        query: expect.stringContaining("OFFSET @offset LIMIT @limit"),
      });

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items).toHaveLength(2);
        expect(response.value.page).toBe(2);
        expect(response.value.page_size).toBe(2);
        expect(response.value.has_more).toBe(true);
      }
    });

    it("should set has_more=true when items.length equals page_size", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 3, 30),
        createProfileVersion(aRetrievedProfileWithEmail, 2, 20),
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(
        mockContext,
        aFiscalCode,
        O.some(1),
        O.some(3),
      );

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.has_more).toBe(true);
      }
    });

    it("should set has_more=false when items.length is less than page_size", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(
        mockContext,
        aFiscalCode,
        O.some(1),
        O.some(10),
      );

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.has_more).toBe(false);
      }
    });

    it("should calculate correct offset for different pages", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      await handler(mockContext, aFiscalCode, O.some(3), O.some(10));

      expect(profileModelMock.getQueryIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.arrayContaining([{ name: "@offset", value: 20 }]),
        }),
      );
    });
  });

  describe("Email Opt-Out Switch Date", () => {
    it("should force isEmailEnabled to false if timestamp is before email opt out switch date", async () => {
      const profileModelMock = createProfileModelMock();
      const profileBeforeLimit = createProfileVersion(
        {
          ...aRetrievedProfileWithEmail,
          isEmailEnabled: true,
        },
        1,
        -100,
      );

      const mockIterator = createMockProfileAsyncIterator([profileBeforeLimit]);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items[0].is_email_enabled).toBe(false);
      }
    });

    it("should NOT force isEmailEnabled to false if timestamp is after email opt out switch date", async () => {
      const profileModelMock = createProfileModelMock();
      const profileAfterLimit = createProfileVersion(
        {
          ...aRetrievedProfileWithEmail,
          isEmailEnabled: true,
        },
        1,
        100,
      );

      const mockIterator = createMockProfileAsyncIterator([profileAfterLimit]);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items[0].is_email_enabled).toBe(true);
      }
    });

    it("should handle mixed timestamps correctly", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(
          { ...aRetrievedProfileWithEmail, isEmailEnabled: true },
          3,
          100,
        ),
        createProfileVersion(
          { ...aRetrievedProfileWithEmail, isEmailEnabled: true },
          2,
          -100,
        ),
        createProfileVersion(
          { ...aRetrievedProfileWithEmail, isEmailEnabled: true },
          1,
          50,
        ),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items[0].is_email_enabled).toBe(true);
        expect(response.value.items[1].is_email_enabled).toBe(false);
        expect(response.value.items[2].is_email_enabled).toBe(true);
      }
    });
  });

  describe("Email Uniqueness", () => {
    it("should check email uniqueness for profiles with unvalidated email", async () => {
      const profileModelMock = createProfileModelMock();
      const profileWithUnvalidatedEmail = createProfileVersion(
        {
          ...aRetrievedProfileWithEmail,
          isEmailValidated: false,
          email: TEST_EMAIL,
        },
        1,
        10,
      );

      const mockIterator = createMockProfileAsyncIterator([
        profileWithUnvalidatedEmail,
      ]);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      // Override the mock to return emails including the test email
      const testProfileEmailReader: IProfileEmailReader = {
        list: vi.fn(() =>
          Promise.resolve([{ email: TEST_EMAIL }, { email: "other@example.com" }]),
        ),
      };

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        testProfileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items[0].is_email_already_taken).toBeDefined();
      }
    });

    it("should NOT check email uniqueness for profiles with validated email", async () => {
      const profileModelMock = createProfileModelMock();
      const profileWithValidatedEmail = createProfileVersion(
        {
          ...aRetrievedProfileWithEmail,
          isEmailValidated: true,
          email: TEST_EMAIL,
        },
        1,
        10,
      );

      const mockIterator = createMockProfileAsyncIterator([
        profileWithValidatedEmail,
      ]);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items[0].is_email_already_taken).toBe(false);
      }
    });

    it("should return ErrorInternal if email uniqueness check fails", async () => {
      const profileModelMock = createProfileModelMock();
      const profileWithUnvalidatedEmail = createProfileVersion(
        {
          ...aRetrievedProfileWithEmail,
          isEmailValidated: false,
          email: TEST_EMAIL,
        },
        1,
        10,
      );

      const mockIterator = createMockProfileAsyncIterator([
        profileWithUnvalidatedEmail,
      ]);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const mockListThrow = vi
        .fn()
        .mockImplementation(generateProfileEmails(7, true));
      const profileEmailReaderWithError: IProfileEmailReader = {
        list: mockListThrow,
      };

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReaderWithError,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseErrorInternal");
    });
  });

  describe("Error Handling", () => {
    it("should return ErrorQuery when Cosmos DB query fails", async () => {
      const profileModelMock = createProfileModelMock();
      const mockIterator = createMockProfileAsyncIterator([], true);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseErrorQuery");
    });

    it("should filter out Left values when O.some profile conversions fail", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 3, 30),
        createProfileVersion(aRetrievedProfileWithEmail, 2, 20),
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIteratorWithErrors(profiles, [
        1,
      ]);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items).toHaveLength(2);
        expect(response.value.items[0].version).toBe(3);
        expect(response.value.items[1].version).toBe(1);
      }
    });

    it("should handle multiple Left values correctly", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 5, 50),
        createProfileVersion(aRetrievedProfileWithEmail, 4, 40),
        createProfileVersion(aRetrievedProfileWithEmail, 3, 30),
        createProfileVersion(aRetrievedProfileWithEmail, 2, 20),
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIteratorWithErrors(
        profiles,
        [1, 3],
      );
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items).toHaveLength(3);
        expect(response.value.items[0].version).toBe(5);
        expect(response.value.items[1].version).toBe(3);
        expect(response.value.items[2].version).toBe(1);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should return empty items array when no profiles match", async () => {
      const profileModelMock = createProfileModelMock();
      const mockIterator = createMockProfileAsyncIterator([]);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items).toHaveLength(0);
        expect(response.value.has_more).toBe(false);
      }
    });

    it("should handle very large page size", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = Array.from({ length: 100 }, (_, i) =>
        createProfileVersion(aRetrievedProfileWithEmail, i + 1, (i + 1) * 10),
      );

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(
        mockContext,
        aFiscalCode,
        O.none,
        O.some(1000),
      );

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items).toHaveLength(100);
        expect(response.value.page_size).toBe(1000);
        expect(response.value.has_more).toBe(false);
      }
    });

    it("should return correct results when all profiles fail conversion", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 3, 30),
        createProfileVersion(aRetrievedProfileWithEmail, 2, 20),
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIteratorWithErrors(
        profiles,
        [0, 1, 2],
      );
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      const response = await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value.items).toHaveLength(0);
        expect(response.value.has_more).toBe(false);
      }
    });
  });

  describe("Query Structure", () => {
    it("should use correct SQL query with fiscal code filter and ordering", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      await handler(mockContext, aFiscalCode, O.none, O.none);

      expect(profileModelMock.getQueryIterator).toHaveBeenCalledWith({
        parameters: expect.any(Array),
        query:
          "SELECT * FROM p WHERE p.fiscalCode = @fiscalCode ORDER BY p._ts DESC OFFSET @offset LIMIT @limit",
      });
    });

    it("should use single partition key for efficient queries", async () => {
      const profileModelMock = createProfileModelMock();
      const profiles = [
        createProfileVersion(aRetrievedProfileWithEmail, 1, 10),
      ];

      const mockIterator = createMockProfileAsyncIterator(profiles);
      profileModelMock.getQueryIterator.mockReturnValue(mockIterator);

      const handler = GetProfileVersionsHandler(
        profileModelMock as never,
        anEmailOptOutEmailSwitchDate,
        profileEmailReader,
      );

      await handler(mockContext, aFiscalCode, O.none, O.none);

      const queryCall = profileModelMock.getQueryIterator.mock.calls[0][0];
      const fiscalCodeParam = queryCall.parameters.find(
        (p: { name: string }) => p.name === FISCAL_CODE_PARAM,
      );

      expect(fiscalCodeParam).toBeDefined();
      expect(fiscalCodeParam.value).toBe(aFiscalCode);
    });
  });
});
