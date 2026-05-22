type StoredString = {
  expiresAt?: number;
  value: string;
};

const clusterInfo = "cluster_state:ok\n";
const lollipopDataPrefix = "KEYS-";
const sessionInfoPrefix = "SESSIONINFO-";
const sessionPrefix = "SESSION-";
const userSessionsPrefix = "USERSESSIONS-";

const nowSeconds = (expiresAt?: number) =>
  expiresAt === undefined ? -1 : Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

const sortObjectKeys = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortObjectKeys(nestedValue)]),
    ) as T;
  }
  return value;
};

export type FakeRedisSnapshot = {
  readonly sets: ReadonlyArray<{
    readonly key: string;
    readonly members: ReadonlyArray<string>;
  }>;
  readonly strings: ReadonlyArray<{
    readonly key: string;
    readonly ttlSeconds: number;
    readonly value: string;
  }>;
};

export type FakeRedisHarness = ReturnType<typeof createFakeRedisHarness>;

export const createFakeRedisHarness = () => {
  const sets = new Map<string, Set<string>>();
  const strings = new Map<string, StoredString>();

  const purgeExpired = (key: string) => {
    const stored = strings.get(key);
    if (stored?.expiresAt !== undefined && stored.expiresAt <= Date.now()) {
      strings.delete(key);
    }
  };

  const client = {
    del: async (key: string) => {
      purgeExpired(key);
      const hadString = strings.delete(key);
      const hadSet = sets.delete(key);
      return Number(hadString || hadSet);
    },
    exists: async (key: string) => {
      purgeExpired(key);
      return Number(strings.has(key) || sets.has(key));
    },
    get: async (key: string) => {
      purgeExpired(key);
      return strings.get(key)?.value ?? null;
    },
    quit: async () => "OK",
    sAdd: async (key: string, value: string) => {
      const set = sets.get(key) ?? new Set<string>();
      const previousSize = set.size;
      set.add(value);
      sets.set(key, set);
      return set.size > previousSize ? 1 : 0;
    },
    sIsMember: async (key: string, value: string) =>
      Number((sets.get(key) ?? new Set<string>()).has(value)),
    sendCommand: async (
      command: string,
      _isolated?: boolean,
      args?: ReadonlyArray<string>,
    ) => {
      if (command === "INFO" && args?.join(" ") === "CLUSTER INFO") {
        return clusterInfo;
      }
      throw new Error(`Unsupported redis command: ${command}`);
    },
    sMembers: async (key: string) => Array.from(sets.get(key) ?? []),
    sRem: async (key: string, value: string) => {
      const set = sets.get(key);
      if (set === undefined) {
        return 0;
      }
      const removed = set.delete(value);
      if (set.size === 0) {
        sets.delete(key);
      }
      return Number(removed);
    },
    setEx: async (key: string, seconds: number, value: string) => {
      strings.set(key, {
        expiresAt: Date.now() + seconds * 1000,
        value,
      });
      return "OK";
    },
    ttl: async (key: string) => {
      purgeExpired(key);
      const stored = strings.get(key);
      return stored === undefined ? -2 : nowSeconds(stored.expiresAt);
    },
  };

  const selector = {
    select: () => [client],
    selectOne: () => client,
  };

  return {
    clear: async () => {
      sets.clear();
      strings.clear();
    },
    getJsonValue: (key: string) => {
      purgeExpired(key);
      const stored = strings.get(key)?.value;
      return stored === undefined ? undefined : JSON.parse(stored);
    },
    getSetMembers: (key: string) => Array.from(sets.get(key) ?? []).sort(),
    getStringValue: (key: string) => {
      purgeExpired(key);
      return strings.get(key)?.value;
    },
    getTtlSeconds: async (key: string) => client.ttl(key),
    seedLollipopAssertionRef: async (
      fiscalCode: string,
      assertionRef: string,
      ttlSeconds = 3600,
    ) => {
      await client.setEx(`${lollipopDataPrefix}${fiscalCode}`, ttlSeconds, assertionRef);
    },
    seedUserSession: async (user: Record<string, string | number>, ttlSeconds = 3600) => {
      const sessionToken = String(user.session_token);
      const fiscalCode = String(user.fiscal_code);
      const stringEntries = [
        [`${sessionPrefix}${sessionToken}`, JSON.stringify(user)],
        [`WALLET-${String(user.wallet_token)}`, sessionToken],
        [`MYPORTAL-${String(user.myportal_token)}`, sessionToken],
        [`BPD-${String(user.bpd_token)}`, sessionToken],
        [`ZENDESK-${String(user.zendesk_token)}`, sessionToken],
        [`FIMS-${String(user.fims_token)}`, sessionToken],
        [
          `${sessionInfoPrefix}${sessionToken}`,
          JSON.stringify({
            createdAt: new Date(Number(user.created_at)).toISOString(),
            sessionToken,
          }),
        ],
      ] as const;

      for (const [key, value] of stringEntries) {
        await client.setEx(key, ttlSeconds, value);
      }
      await client.sAdd(`${userSessionsPrefix}${fiscalCode}`, `${sessionInfoPrefix}${sessionToken}`);
    },
    selector,
    snapshot: async (): Promise<FakeRedisSnapshot> => {
      for (const key of Array.from(strings.keys())) {
        purgeExpired(key);
      }
      return {
        sets: Array.from(sets.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, members]) => ({
            key,
            members: Array.from(members).sort(),
          })),
        strings: await Promise.all(
          Array.from(strings.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(async ([key, stored]) => ({
              key,
              ttlSeconds: await client.ttl(key),
              value:
                key.startsWith(sessionPrefix) || key.startsWith(sessionInfoPrefix)
                  ? JSON.stringify(sortObjectKeys(JSON.parse(stored.value)), null, 2)
                  : stored.value,
            })),
        ),
      };
    },
  };
};
