import { appendFileSync } from "fs";
import { describe, it, vi, afterEach, expect, Mock } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { ProcessFiscalCode } from "../invoker";
import { Config } from "../types";

vi.mock("fs");
const mockAppendFile = vi
  .mocked(appendFileSync)
  .mockImplementation(() => void 0);

// eslint-disable-next-line functional/immutable-data
global.fetch = vi.fn() as unknown as typeof fetch;

describe("ProcessFiscalCode", () => {
  const fiscalCode: FiscalCode = "RSSMRA85M01H501Z" as FiscalCode;
  const config: Config = {
    apiUrl: "https://example.com/users/{fiscalCode}/status",
    apiKey: "secret",
    errorsFiscalCodesFilePath: "/tmp/errors.txt",
    dryRun: true,
  } as Config;

  afterEach(() => {
    vi.clearAllMocks();
    mockAppendFile.mockReset();
  });

  it("should succeed in dry run mode and log info", async () => {
    const result = await ProcessFiscalCode(fiscalCode)(config)();
    expect(E.isRight(result)).toBe(true);
  });

  it("should succeed when fetch succeeds", async () => {
    (global.fetch as unknown as Mock).mockResolvedValueOnce(
      new Response("OK", { status: 200 }),
    );

    const result = await ProcessFiscalCode(fiscalCode)({
      ...config,
      dryRun: false,
    })();

    expect(mockAppendFile).not.toHaveBeenCalled();
    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(new Response("OK", { status: 200 })));
  });

  it("should call appendFile on fetch error and return Left", async () => {
    const response = new Response("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
    (global.fetch as unknown as Mock).mockResolvedValueOnce(response);

    const result = await ProcessFiscalCode(fiscalCode)({
      ...config,
      dryRun: false,
    })();

    expect(mockAppendFile).toHaveBeenCalledExactlyOnceWith(
      config.errorsFiscalCodesFilePath,
      expect.stringContaining(fiscalCode),
      "utf-8",
    );

    expect(E.isLeft(result)).toBe(true);
    const expectedUrl = config.apiUrl.replace("{fiscalCode}", fiscalCode);
    expect(result).toMatchObject(
      E.left(
        new Error(
          `Failed HTTP PUT '${expectedUrl}': HTTP ${response.status} ${response.statusText}`,
        ),
      ),
    );
  });

  it("should return Left when appendFile fails", async () => {
    const response = new Response("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
    (global.fetch as unknown as Mock).mockResolvedValueOnce(response);

    mockAppendFile.mockImplementationOnce(() => {
      throw new Error("Write operation failed");
    });

    const result = await ProcessFiscalCode(fiscalCode)({
      ...config,
      dryRun: false,
    })();

    expect(mockAppendFile).toHaveBeenCalledExactlyOnceWith(
      config.errorsFiscalCodesFilePath,
      expect.stringContaining(fiscalCode),
      "utf-8",
    );

    expect(E.isLeft(result)).toBe(true);
    if (result._tag === "Left") {
      expect(result.left.message).toContain("Write operation failed");
      expect(result.left.message).toContain("Failed HTTP PUT");
      expect(result.left.message).toContain(fiscalCode);
      expect(result.left.message).toContain("HTTP 500 Internal Server Error");
    }
  });
});
