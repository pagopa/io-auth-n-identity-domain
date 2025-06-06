import { vi } from "vitest";

/**
 * mockReq generate a mocked version of an Express Request
 *
 * @returns A mocked express Request
 */
export default function mockReq({
  params = {},
  headers = {},
  body = {},
  query = {},
  user = {},
  ip = "10.0.0.1",
  cookies = {},
} = {}) {
  const request = {
    accepts: vi.fn(),
    acceptsCharset: vi.fn(),
    acceptsCharsets: vi.fn(),
    acceptsEncoding: vi.fn(),
    acceptsEncodings: vi.fn(),
    acceptsLanguage: vi.fn(),
    acceptsLanguages: vi.fn(),
    body,
    cookies,
    header: vi.fn(),
    headers,
    is: vi.fn(),
    ip,
    param: vi.fn(),
    params,
    query,
    range: vi.fn(),
    reset: resetMock,
    user,
  };

  request.header.mockImplementation(() => request);
  request.accepts.mockImplementation(() => request);
  request.acceptsEncodings.mockImplementation(() => request);
  request.acceptsEncoding.mockImplementation(() => request);
  request.acceptsCharsets.mockImplementation(() => request);
  request.acceptsCharset.mockImplementation(() => request);
  request.acceptsLanguages.mockImplementation(() => request);
  request.acceptsLanguage.mockImplementation(() => request);
  request.range.mockImplementation(() => request);
  request.param.mockImplementation(
    (name: string) => ({ ...params, ...body, ...query })[name],
  );
  request.is.mockImplementation(() => request);

  return request;
}

/**
 * resetMock
 */
function resetMock(this: ReturnType<typeof mockReq>) {
  this.header.mockClear();
  this.accepts.mockClear();
  this.acceptsEncodings.mockClear();
  this.acceptsEncoding.mockClear();
  this.acceptsCharsets.mockClear();
  this.acceptsCharset.mockClear();
  this.acceptsLanguages.mockClear();
  this.acceptsLanguage.mockClear();
  this.range.mockClear();
  this.param.mockClear();
  this.is.mockClear();
}
