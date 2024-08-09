import { vi } from "vitest";

/**
 * mockRes generate a mocked version of an Express Response
 *
 * @returns A mocked express Response
 */

export default function mockRes() {
  const response = {
    append: vi.fn(),
    attachment: vi.fn(),
    clearCookie: vi.fn(),
    cookie: vi.fn(),
    download: vi.fn(),
    end: vi.fn(),
    format: vi.fn(),
    get: vi.fn(),
    json: vi.fn(),
    jsonp: vi.fn(),
    links: vi.fn(),
    location: vi.fn(),
    redirect: vi.fn(),
    render: vi.fn(),
    reset: resetMock,
    send: vi.fn(),
    sendFile: vi.fn(),
    sendStatus: vi.fn(),
    set: vi.fn(),
    status: vi.fn(),
    type: vi.fn(),
    vary: vi.fn(),
    header: vi.fn(),
  };

  response.append.mockImplementation(() => response);
  response.attachment.mockImplementation(() => response);
  response.cookie.mockImplementation(() => response);
  response.clearCookie.mockImplementation(() => response);
  response.download.mockImplementation(() => response);
  response.end.mockImplementation(() => response);
  response.format.mockImplementation(() => response);
  response.get.mockImplementation(() => response);
  response.json.mockImplementation(() => response);
  response.jsonp.mockImplementation(() => response);
  response.links.mockImplementation(() => response);
  response.location.mockImplementation(() => response);
  response.redirect.mockImplementation(() => response);
  response.render.mockImplementation(() => response);
  response.send.mockImplementation(() => response);
  response.sendFile.mockImplementation(() => response);
  response.sendStatus.mockImplementation(() => response);
  response.links.mockImplementation(() => response);
  response.set.mockImplementation(() => response);
  response.status.mockImplementation(() => response);
  response.type.mockImplementation(() => response);
  response.vary.mockImplementation(() => response);
  response.header.mockImplementation(() => response);

  return response;
}

/**
 * resetMock
 */
export function resetMock(res: ReturnType<typeof mockRes>) {
  res.append.mockClear();
  res.attachment.mockClear();
  res.cookie.mockClear();
  res.clearCookie.mockClear();
  res.download.mockClear();
  res.end.mockClear();
  res.format.mockClear();
  res.get.mockClear();
  res.json.mockClear();
  res.jsonp.mockClear();
  res.links.mockClear();
  res.location.mockClear();
  res.redirect.mockClear();
  res.render.mockClear();
  res.send.mockClear();
  res.sendFile.mockClear();
  res.sendStatus.mockClear();
  res.links.mockClear();
  res.set.mockClear();
  res.status.mockClear();
  res.type.mockClear();
  res.vary.mockClear();
  res.header.mockClear();
}
