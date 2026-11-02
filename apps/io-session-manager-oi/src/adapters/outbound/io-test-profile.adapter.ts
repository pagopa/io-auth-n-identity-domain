import {
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import { type UserProfile } from "../../domain/entities/profile.entity.js";
import type {
  NotifyLoginParamsDTO,
  ProfilePort,
} from "../../domain/ports/outbound/profile.port.js";

export const createIoTestProfileAdapter = (
  ioProfilePort: ProfilePort,
): ProfilePort => ({
  getProfile: async (
    fiscalCode: FiscalCode,
  ): Promise<Result<UserProfile, NotFoundError | GenericError>> =>
    ioProfilePort.getProfile(fiscalCode),
  create: async (
    newProfile: UserProfile,
  ): Promise<Result<UserProfile, ConflictError | GenericError>> =>
    ioProfilePort.create({ ...newProfile, isTestProfile: true }),
  notifyLogin: async (
    params: NotifyLoginParamsDTO,
  ): Promise<Result<void, GenericError>> => ioProfilePort.notifyLogin(params),
});
