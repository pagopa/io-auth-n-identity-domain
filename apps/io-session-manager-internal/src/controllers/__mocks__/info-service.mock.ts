import { vi } from "vitest";
import { InfoService } from "../../services/info";
import { aPackageInfo } from "../../__mocks__/package.mock";

export const mockInfoService: InfoService = {
  getPackageInfo: vi.fn(() => Promise.resolve(aPackageInfo)),
} as unknown as InfoService;
