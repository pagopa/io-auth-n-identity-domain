import type { UseCase } from "@pagopa/io-core-domain";
import { ForbiddenError, ValidationError } from "@pagopa/io-core-domain/errors";
import { err, ok } from "neverthrow";
import * as rangeCheck from "range_check";
import { z } from "zod";

const IPSchema = z.union([z.ipv4(), z.ipv6()]);

export interface CheckIpInput {
  readonly ip: string;
  readonly allowedCIDRs: ReadonlyArray<string>;
}

export const checkIpUseCase: UseCase<
  CheckIpInput,
  void,
  ValidationError | ForbiddenError
> = async ({ ip, allowedCIDRs }) => {
  if (!IPSchema.safeParse(ip).success) {
    return err(new ValidationError("Unable to parse client IP address."));
  }

  if (!rangeCheck.inRange(ip, Array.from(allowedCIDRs))) {
    return err(new ForbiddenError());
  }

  return ok(undefined);
};
