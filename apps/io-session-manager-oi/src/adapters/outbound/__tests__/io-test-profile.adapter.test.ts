import {
  ConflictError,
  EmailAddress,
  FiscalCodeSchema,
  GenericError,
  NonEmptyStringSchema,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "../../../domain/entities/profile.entity.js";
import type { NotifyLoginParamsDTO } from "../../../domain/ports/outbound/profile.port.js";
import { createIoTestProfileAdapter } from "../io-test-profile.adapter.js";

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const createMockProfilePort = () => ({
  getProfile: vi.fn(),
  create: vi.fn(),
  notifyLogin: vi.fn(),
});

describe("createIoTestProfileAdapter", () => {
  let mockProfilePort: ReturnType<typeof createMockProfilePort>;
  let adapter: ReturnType<typeof createIoTestProfileAdapter>;

  beforeEach(() => {
    mockProfilePort = createMockProfilePort();
    adapter = createIoTestProfileAdapter(mockProfilePort);
  });

  describe("getProfile", () => {
    it("delegates to underlying port", async () => {
      const expectedProfile: UserProfile = {
        fiscalCode: FISCAL_CODE,
        email: "user@example.com" as EmailAddress,
        isEmailValidated: true,
        isTestProfile: false,
      };

      vi.mocked(mockProfilePort.getProfile).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => expectedProfile,
      } as any);

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(mockProfilePort.getProfile).toHaveBeenCalledWith(FISCAL_CODE);
      expect(mockProfilePort.getProfile).toHaveBeenCalledTimes(1);
      expect(result._unsafeUnwrap()).toEqual(expectedProfile);
    });

    it("returns NotFoundError from underlying port", async () => {
      const error = new NotFoundError("Profile", "Not found");

      vi.mocked(mockProfilePort.getProfile).mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        _unsafeUnwrapErr: () => error,
      } as any);

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(error);
    });

    it("returns GenericError from underlying port", async () => {
      const error = new GenericError("Something went wrong");

      vi.mocked(mockProfilePort.getProfile).mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        _unsafeUnwrapErr: () => error,
      } as any);

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(error);
    });
  });

  describe("create", () => {
    it("forces isTestProfile to true when creating", async () => {
      const newProfile: UserProfile = {
        fiscalCode: FISCAL_CODE,
        email: "user@example.com" as EmailAddress,
        isEmailValidated: false,
        isTestProfile: false,
      };

      const expectedResult: UserProfile = {
        ...newProfile,
        isTestProfile: true,
      };

      vi.mocked(mockProfilePort.create).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => expectedResult,
      } as any);

      const result = await adapter.create(newProfile);

      expect(mockProfilePort.create).toHaveBeenCalledWith({
        ...newProfile,
        isTestProfile: true,
      });
      expect(result._unsafeUnwrap()).toEqual(expectedResult);
    });

    it("overrides isTestProfile=undefined to true", async () => {
      const newProfile: UserProfile = {
        fiscalCode: FISCAL_CODE,
        email: "user@example.com" as EmailAddress,
        isEmailValidated: false,
      };

      vi.mocked(mockProfilePort.create).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => ({ ...newProfile, isTestProfile: true }),
      } as any);

      await adapter.create(newProfile);

      expect(mockProfilePort.create).toHaveBeenCalledWith({
        fiscalCode: FISCAL_CODE,
        email: "user@example.com",
        isEmailValidated: false,
        isTestProfile: true,
      });
    });

    it("preserves email when present", async () => {
      const email = "test@example.com" as EmailAddress;
      const newProfile: UserProfile = {
        fiscalCode: FISCAL_CODE,
        email,
        isEmailValidated: true,
      };

      vi.mocked(mockProfilePort.create).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => ({ ...newProfile, isTestProfile: true }),
      } as any);

      await adapter.create(newProfile);

      const callArgs = vi.mocked(mockProfilePort.create).mock.calls[0][0];
      expect(callArgs.email).toBe(email);
      expect(callArgs.isTestProfile).toBe(true);
    });

    it("handles profile without email", async () => {
      const newProfile: UserProfile = {
        fiscalCode: FISCAL_CODE,
        isEmailValidated: false,
      };

      vi.mocked(mockProfilePort.create).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => ({ ...newProfile, isTestProfile: true }),
      } as any);

      await adapter.create(newProfile);

      const callArgs = vi.mocked(mockProfilePort.create).mock.calls[0][0];
      expect(callArgs.email).toBeUndefined();
      expect(callArgs.isTestProfile).toBe(true);
    });

    it("returns ConflictError from underlying port", async () => {
      const newProfile: UserProfile = {
        fiscalCode: FISCAL_CODE,
        isEmailValidated: false,
      };

      const error = new ConflictError("Profile already exists");

      vi.mocked(mockProfilePort.create).mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        _unsafeUnwrapErr: () => error,
      } as any);

      const result = await adapter.create(newProfile);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(error);
    });

    it("returns GenericError from underlying port", async () => {
      const newProfile: UserProfile = {
        fiscalCode: FISCAL_CODE,
        isEmailValidated: false,
      };

      const error = new GenericError("Creation failed");

      vi.mocked(mockProfilePort.create).mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        _unsafeUnwrapErr: () => error,
      } as any);

      const result = await adapter.create(newProfile);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(error);
    });
  });

  describe("notifyLogin", () => {
    it("delegates to underlying port", async () => {
      const params: NotifyLoginParamsDTO = {
        fiscalCode: FISCAL_CODE,
        name: NonEmptyStringSchema.parse("Mario"),
        familyName: NonEmptyStringSchema.parse("Rossi"),
        email: "user@example.com" as EmailAddress,
        identityProvider: NonEmptyStringSchema.parse("spid"),
        ipAddress: "127.0.0.1",
      };

      vi.mocked(mockProfilePort.notifyLogin).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => undefined,
      } as any);

      const result = await adapter.notifyLogin(params);

      expect(mockProfilePort.notifyLogin).toHaveBeenCalledWith(params);
      expect(mockProfilePort.notifyLogin).toHaveBeenCalledTimes(1);
      expect(result.isOk()).toBe(true);
    });

    it("preserves all notification params", async () => {
      const params: NotifyLoginParamsDTO = {
        fiscalCode: FISCAL_CODE,
        name: NonEmptyStringSchema.parse("Alice"),
        familyName: NonEmptyStringSchema.parse("Smith"),
        email: "alice@example.com" as EmailAddress,
        identityProvider: NonEmptyStringSchema.parse("cie"),
        ipAddress: "192.168.1.1",
        isEmailValidated: true,
      };

      vi.mocked(mockProfilePort.notifyLogin).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => undefined,
      } as any);

      await adapter.notifyLogin(params);

      expect(mockProfilePort.notifyLogin).toHaveBeenCalledWith(params);
    });

    it("returns GenericError from underlying port", async () => {
      const params: NotifyLoginParamsDTO = {
        fiscalCode: FISCAL_CODE,
        name: NonEmptyStringSchema.parse("Bob"),
        familyName: NonEmptyStringSchema.parse("Johnson"),
        email: "bob@example.com" as EmailAddress,
        identityProvider: NonEmptyStringSchema.parse("spid"),
        ipAddress: "10.0.0.1",
      };

      const error = new GenericError("Notification failed");

      vi.mocked(mockProfilePort.notifyLogin).mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        _unsafeUnwrapErr: () => error,
      } as any);

      const result = await adapter.notifyLogin(params);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(error);
    });
  });
});
