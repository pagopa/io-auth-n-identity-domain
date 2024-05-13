import { Mock, vi } from "vitest";

import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";

import { RedisSessionStorageService } from "../../services";

import { AssertionRef } from "../../generated/lollipop-api/AssertionRef";

import { anAssertionRef } from "../lollipop.mocks";

export const mockGetLollipopAssertionRefForUser: Mock<
  Parameters<
    (typeof RedisSessionStorageService)["getLollipopAssertionRefForUser"]
  >,
  ReturnType<
    (typeof RedisSessionStorageService)["getLollipopAssertionRefForUser"]
  >
> = vi.fn((_deps) => TE.of(O.some(anAssertionRef as AssertionRef)));

export const mockedRedisSessionStorageService: typeof RedisSessionStorageService =
  {
    getLollipopAssertionRefForUser: mockGetLollipopAssertionRefForUser,
    getByFIMSToken: vi.fn(),
    getBySessionToken: vi.fn(),
    loadSessionByToken: vi.fn(),
    set: vi.fn(),
  };
