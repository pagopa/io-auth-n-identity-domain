import { Tuple2 } from "@pagopa/ts-commons/lib/tuples";
import { describe, expect, it } from "vitest";

import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";

import { diffBlockedServices } from "../profiles";

describe("diffBlockedServices", () => {
  const service1 = "service1";

  it("should return an added service when old blocked is null", () => {
    const oldPrefs = null;

    const newPrefs = {
      [service1]: [BlockedInboxOrChannelEnum.INBOX],
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([service1], []));
  });

  it("should return an added service when old blocked is undefined", () => {
    const oldPrefs = undefined;

    const newPrefs = {
      [service1]: [BlockedInboxOrChannelEnum.INBOX],
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([service1], []));
  });

  it("should return an added service when has been just blocked", () => {
    const oldPrefs = {
      [service1]: [],
    };

    const newPrefs = {
      [service1]: [BlockedInboxOrChannelEnum.INBOX],
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([service1], []));
  });

  it("should return nothing when the service is still blocked", () => {
    const oldPrefs = {
      [service1]: [BlockedInboxOrChannelEnum.INBOX],
    };

    const newPrefs = {
      [service1]: [BlockedInboxOrChannelEnum.INBOX],
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([], []));
  });

  it("should return a removed service when has been just unblocked", () => {
    const oldPrefs = {
      [service1]: [BlockedInboxOrChannelEnum.INBOX],
    };

    const newPrefs = {
      [service1]: [],
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([], [service1]));
  });

  it("should ignore non-inbox channels", () => {
    expect(
      diffBlockedServices(
        {
          [service1]: [
            BlockedInboxOrChannelEnum.INBOX,
            BlockedInboxOrChannelEnum.EMAIL,
          ],
        },
        {
          [service1]: [BlockedInboxOrChannelEnum.INBOX],
        },
      ),
    ).toEqual(Tuple2([], []));
    expect(
      diffBlockedServices(
        {
          [service1]: [BlockedInboxOrChannelEnum.INBOX],
        },
        {
          [service1]: [
            BlockedInboxOrChannelEnum.INBOX,
            BlockedInboxOrChannelEnum.EMAIL,
          ],
        },
      ),
    ).toEqual(Tuple2([], []));
  });
});
