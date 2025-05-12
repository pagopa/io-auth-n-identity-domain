import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { QueueClient } from "@azure/storage-queue";
import { TableClient } from "@azure/data-tables";
import {
  RedisClientTaskMock,
  RedisRepositoryMock,
  mockDelLollipopDataForUser,
  mockDelUserAllSessions,
  mockGetLollipopAssertionRefForUser,
  mockUserHasActiveSessionsOrLV,
} from "../../__mocks__/repositories/redis.mock";
import { SessionService } from "../session-service";
import {
  AuthLockRepositoryMock,
  mockIsUserAuthenticationLocked,
  mockLockUserAuthentication,
} from "../../__mocks__/repositories/auth-lock.mock";
import { LollipopRepositoryMock } from "../../__mocks__/repositories/lollipop.mock";
import {
  InstallationRepositoryMock,
  mockDeleteInstallation,
} from "../../__mocks__/repositories/installation.mock";
import { anUnlockCode } from "../../__mocks__/user.mock";
import { conflictError, toGenericError } from "../../utils/errors";

const aFiscalCode = "SPNDNL80R13C555X" as FiscalCode;

describe("Session Service#userHasActiveSessionsOrLV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const deps = {
    FastRedisClientTask: RedisClientTaskMock,
    SafeRedisClientTask: RedisClientTaskMock,
    RedisRepository: RedisRepositoryMock,
  };

  it.each`
    title         | active
    ${"active"}   | ${true}
    ${"inactive"} | ${false}
  `("should succeed with an $title session", async ({ active }) => {
    mockUserHasActiveSessionsOrLV.mockReturnValueOnce(TE.right(active));

    const result = await SessionService.getUserSession(aFiscalCode)(deps)();

    expect(mockUserHasActiveSessionsOrLV).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.right({ active }));
  });

  it("should error if userHasActiveSessionsOrLV fails", async () => {
    const customError = Error("custom error");
    mockUserHasActiveSessionsOrLV.mockReturnValueOnce(TE.left(customError));
    const result = await SessionService.getUserSession(aFiscalCode)(deps)();

    expect(mockUserHasActiveSessionsOrLV).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(customError));
  });
});

describe("Session Service#lockUserAuthentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const deps = {
    FastRedisClientTask: RedisClientTaskMock,
    SafeRedisClientTask: RedisClientTaskMock,
    RedisRepository: RedisRepositoryMock,

    AuthLockRepository: AuthLockRepositoryMock,
    AuthenticationLockTableClient: {} as TableClient,
    LollipopRepository: LollipopRepositoryMock,
    RevokeAssertionRefQueueClient: {} as QueueClient,
    InstallationRepository: InstallationRepositoryMock,
    NotificationQueueClient: {} as QueueClient,
  };

  it("should succeed to lock an user authentication", async () => {
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(result).toEqual(E.right(null));
  });

  it("should fail when redis is not available", async () => {
    const anErrorMessage = "ERROR";
    const expectedError = toGenericError(
      `Could not establish connection to redis: ${anErrorMessage}`,
    );
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )({
      ...deps,
      FastRedisClientTask: TE.left(Error(anErrorMessage)),
    })();

    expect(result).toEqual(E.left(expectedError));
  });

  it("should fail when the lock cant be retrieved", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockIsUserAuthenticationLocked.mockReturnValueOnce(RTE.left(anError));
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockIsUserAuthenticationLocked).toHaveBeenCalledTimes(1);

    expect(result).toEqual(E.left(expectedError));
  });

  it("should fail and return conflict when a lock is already present", async () => {
    const expectedError = conflictError;
    mockIsUserAuthenticationLocked.mockReturnValueOnce(RTE.right(true));
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();
    expect(mockIsUserAuthenticationLocked).toHaveBeenCalledTimes(1);

    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when assertionref retrieval fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when delete of lollipopdata fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockDelLollipopDataForUser.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when delete of all sessions fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockDelUserAllSessions.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when the installation clear fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(
      `Cannot delete Notification Installation: ${anError.message}`,
    );
    mockDeleteInstallation.mockReturnValueOnce(RTE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockDeleteInstallation).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when the lock action fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockLockUserAuthentication.mockReturnValueOnce(RTE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockLockUserAuthentication).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(expectedError));
  });
});
