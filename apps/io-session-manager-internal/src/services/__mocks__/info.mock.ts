import { vi } from "vitest";
import * as E from "fp-ts/Either";
import { InfoService } from "../info";
import { aPackageInfo } from "../../repositories/__mocks__/package.mock";

export const mockInfoService: InfoService = {
  getPackageInfo: vi.fn(() => () => Promise.resolve(E.right(aPackageInfo))),
};
