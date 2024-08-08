import { Mock, vi } from "vitest";

import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";

import { Second } from "@pagopa/ts-commons/lib/units";
import { RedisSessionStorageService } from "../../services";

import { AssertionRef } from "../../generated/lollipop-api/AssertionRef";

import { anAssertionRef } from "../lollipop.mocks";

type GetLollipopAssertionRefForUser =
  typeof RedisSessionStorageService.getLollipopAssertionRefForUser;
type DelLollipopDataForUser =
  typeof RedisSessionStorageService.delLollipopDataForUser;
type DeleteUser = typeof RedisSessionStorageService.deleteUser;

export const mockGetLollipopAssertionRefForUser: Mock<
  Parameters<GetLollipopAssertionRefForUser>,
  ReturnType<GetLollipopAssertionRefForUser>
> = vi.fn((_deps) => TE.of(O.some(anAssertionRef as AssertionRef)));

export const mockDelLollipopDataForUser: Mock<
  Parameters<DelLollipopDataForUser>,
  ReturnType<DelLollipopDataForUser>
> = vi.fn((_deps) => TE.of(true));

export const mockDeleteUser: Mock<
  Parameters<DeleteUser>,
  ReturnType<DeleteUser>
> = vi.fn((_) => (_deps) => TE.of(true));

export const mockedRedisSessionStorageService: typeof RedisSessionStorageService =
  {
    getLollipopAssertionRefForUser: mockGetLollipopAssertionRefForUser,
    delLollipopDataForUser: mockDelLollipopDataForUser,
    getByFIMSToken: vi.fn(),
    getByBPDToken: vi.fn(),
    getByZendeskToken: vi.fn(),
    getBySessionToken: vi.fn(),
    loadSessionByToken: vi.fn(),
    set: vi.fn(),
    deleteUser: mockDeleteUser,
    isBlockedUser: vi.fn(),
    DEFAULT_LOLLIPOP_ASSERTION_REF_DURATION: 100 as Second,
    setLollipopAssertionRefForUser: vi.fn(),
    setLollipopDataForUser: vi.fn(),
  };
