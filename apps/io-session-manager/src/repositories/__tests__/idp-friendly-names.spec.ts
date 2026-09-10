import { describe, expect, it, vi } from "vitest";
import { OidcConfigurationEnvEnum } from "../../generated/backend/OidcConfigurationEnv";
import {
  GetIdpFriendlyName,
  IdpFriendlyNamesDeps,
  makeGetIdpFriendlyName,
} from "../idp-friendly-names";

const posteId = "https://posteid.poste.it";
const aProdList = {
  [posteId]: "Poste ID",
  "https://loginspid.aruba.it": "Aruba ID",
};
const anUpdatedProdList = {
  [posteId]: "Poste ID updated",
};

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const makeDeps = (
  overrides: Partial<IdpFriendlyNamesDeps> = {},
): IdpFriendlyNamesDeps => ({
  fetchApi: vi.fn(),
  now: () => 0,
  cacheTtlSeconds: 3600,
  cache: new Map(),
  ...overrides,
});

const makeLookup = (overrides: Partial<IdpFriendlyNamesDeps> = {}) => {
  const getIdpFriendlyName: GetIdpFriendlyName = makeGetIdpFriendlyName(
    makeDeps(overrides),
  );
  return {
    lookup: (identifier = posteId): Promise<string> =>
      getIdpFriendlyName(OidcConfigurationEnvEnum.PROD, identifier)(),
  };
};

describe("getIdpFriendlyName", () => {
  it("should fetch once and reuse the cached name while the entry is fresh", async () => {
    const fetchApi = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(aProdList))
      .mockResolvedValueOnce(jsonResponse({ other: "value" }));
    const { lookup } = makeLookup({ fetchApi, now: () => 0 });

    expect(await lookup()).toBe("Poste ID");
    expect(await lookup()).toBe("Poste ID");
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });

  it("should share a single in-flight fetch for the same environment", async () => {
    let resolveJson: (body: unknown) => void = () => undefined;
    const jsonPromise = new Promise<unknown>((resolve) => {
      resolveJson = resolve;
    });
    const fetchApi = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => jsonPromise,
    } as Response);
    const { lookup } = makeLookup({ fetchApi });

    const first = lookup();
    const second = lookup();
    resolveJson(aProdList);

    expect(await Promise.all([first, second])).toEqual([
      "Poste ID",
      "Poste ID",
    ]);
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });

  it("should refetch after the TTL expires", async () => {
    let now = 0;
    const fetchApi = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(aProdList))
      .mockResolvedValueOnce(jsonResponse(anUpdatedProdList));
    const { lookup } = makeLookup({
      fetchApi,
      cacheTtlSeconds: 10,
      now: () => now,
    });

    expect(await lookup()).toBe("Poste ID");
    now = 9_999;
    expect(await lookup()).toBe("Poste ID");
    expect(fetchApi).toHaveBeenCalledTimes(1);

    now = 10_000;
    expect(await lookup()).toBe("Poste ID updated");
    expect(fetchApi).toHaveBeenCalledTimes(2);
  });

  it("should use last-known-good after TTL expiry when the refetch fails", async () => {
    let now = 0;
    const fetchApi = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(aProdList))
      .mockRejectedValueOnce(new Error("network down"));
    const { lookup } = makeLookup({
      fetchApi,
      cacheTtlSeconds: 10,
      now: () => now,
    });

    expect(await lookup()).toBe("Poste ID");
    now = 10_001;
    expect(await lookup()).toBe("Poste ID");
  });

  it("should return Sconosciuto when the fetch fails and no last-known-good exists", async () => {
    const fetchApi = vi.fn().mockRejectedValue(new Error("network down"));
    const { lookup } = makeLookup({ fetchApi });

    expect(await lookup()).toBe("Sconosciuto");
  });

  it("should retry after a failed fetch", async () => {
    const fetchApi = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse(aProdList));
    const { lookup } = makeLookup({ fetchApi });

    expect(await lookup()).toBe("Sconosciuto");
    expect(await lookup()).toBe("Poste ID");
    expect(fetchApi).toHaveBeenCalledTimes(2);
  });

  it("should not refresh TTL when falling back to last-known-good", async () => {
    let now = 0;
    const fetchApi = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(aProdList))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse(anUpdatedProdList));
    const { lookup } = makeLookup({
      fetchApi,
      cacheTtlSeconds: 10,
      now: () => now,
    });

    expect(await lookup()).toBe("Poste ID");
    now = 10_001;
    expect(await lookup()).toBe("Poste ID");
    now = 10_002;
    expect(await lookup()).toBe("Poste ID updated");
    expect(fetchApi).toHaveBeenCalledTimes(3);
  });

  it("should return Sconosciuto when the identifier is missing from the map", async () => {
    const fetchApi = vi.fn().mockResolvedValue(jsonResponse(aProdList));
    const { lookup } = makeLookup({ fetchApi });
    const identifier = "https://unknown.example/idp";

    expect(await lookup(identifier)).toBe("Sconosciuto");
  });
});
