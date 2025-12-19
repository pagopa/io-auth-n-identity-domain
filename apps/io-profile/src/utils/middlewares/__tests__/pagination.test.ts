import { describe, expect, it } from "vitest";
import * as E from "fp-ts/lib/Either";
import { Request } from "express";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  PageQueryMiddleware,
  PageSize,
  PageSizeQueryMiddleware,
} from "../pagination";

type MockRequest = Pick<Request, "query"> & { query: Record<string, string> };

describe("PageSize codec", () => {
  describe("valid values", () => {
    it("should accept valid page size within range (1-100)", () => {
      const result = PageSize.decode(50);
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe(50);
      }
    });

    it("should accept minimum valid page size (1)", () => {
      const result = PageSize.decode(1);
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe(1);
      }
    });

    it("should accept page size near maximum (99)", () => {
      const result = PageSize.decode(99);
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe(99);
      }
    });

    it("should reject page size of 0", () => {
      const result = PageSize.decode(0);
      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject negative page size", () => {
      const result = PageSize.decode(-5);
      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject page size greater than 100", () => {
      const result = PageSize.decode(101);
      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject non-integer page size", () => {
      const result = PageSize.decode(50.5);
      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject non-numeric page size", () => {
      const result = PageSize.decode("50");
      expect(E.isLeft(result)).toBe(true);
    });
  });
});

describe("PageSizeQueryMiddleware", () => {
  describe("default behavior", () => {
    it("should use default page size when page_size is missing", async () => {
      const mockRequest: MockRequest = {
        query: {},
      };

      const result = await PageSizeQueryMiddleware(mockRequest as Request);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe(DEFAULT_PAGE_SIZE);
      }
    });

    it("should reject page_size of 0", async () => {
      const mockRequest: MockRequest = {
        query: {
          page_size: "0",
        },
      };

      const result = await PageSizeQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject negative page_size", async () => {
      const mockRequest: MockRequest = {
        query: {
          page_size: "-10",
        },
      };

      const result = await PageSizeQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject page_size greater than 100", async () => {
      const mockRequest: MockRequest = {
        query: {
          page_size: "150",
        },
      };

      const result = await PageSizeQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject invalid string for page_size", async () => {
      const mockRequest: MockRequest = {
        query: {
          page_size: "invalid",
        },
      };

      const result = await PageSizeQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject decimal page_size", async () => {
      const mockRequest: MockRequest = {
        query: {
          page_size: "50.5",
        },
      };

      const result = await PageSizeQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });
  });
});

describe("PageQueryMiddleware", () => {
  describe("valid page numbers", () => {
    it("should accept page number 1", async () => {
      const mockRequest: MockRequest = {
        query: {
          page: "1",
        },
      };

      const result = await PageQueryMiddleware(mockRequest as Request);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe(1);
      }
    });

    it("should accept large page numbers", async () => {
      const mockRequest: MockRequest = {
        query: {
          page: "999",
        },
      };

      const result = await PageQueryMiddleware(mockRequest as Request);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe(999);
      }
    });
  });

  describe("invalid page numbers", () => {
    it("should reject page number 0", async () => {
      const mockRequest: MockRequest = {
        query: {
          page: "0",
        },
      };

      const result = await PageQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject negative page numbers", async () => {
      const mockRequest: MockRequest = {
        query: {
          page: "-5",
        },
      };

      const result = await PageQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject invalid string for page", async () => {
      const mockRequest: MockRequest = {
        query: {
          page: "invalid",
        },
      };

      const result = await PageQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should reject decimal page numbers", async () => {
      const mockRequest: MockRequest = {
        query: {
          page: "5.5",
        },
      };

      const result = await PageQueryMiddleware(mockRequest as Request);

      expect(E.isLeft(result)).toBe(true);
    });
  });
});

describe("Pagination constants", () => {
  it("should have DEFAULT_PAGE_SIZE of 25", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it("should have DEFAULT_PAGE of 1", () => {
    expect(DEFAULT_PAGE).toBe(1);
  });
});
