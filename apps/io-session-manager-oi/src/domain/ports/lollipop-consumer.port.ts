import type { Result } from "neverthrow";

import type {
  ForbiddenError,
  GenericError,
} from "@pagopa/io-core-domain/errors";

import type { FiscalCode } from "@pagopa/io-core-domain";
import type {
  LcParams,
  LollipopRequiredHeaders,
} from "@pagopa/io-auth-n-identity-domain";

/**
 * Port for resolving Lollipop Consumer (LC) params from the lollipop service.
 *
 * Implementations (adapters) call the fn-lollipop API and optionally Redis
 * to resolve and validate the assertion ref for the given headers.
 *
 * @param headers  - Validated lollipop request headers extracted from the inbound request.
 * @param fiscalCode - Fiscal code of the authenticated user, when available.
 *                    When provided the implementation validates the assertion ref
 *                    stored in Redis against the key thumbprint in the signature.
 *                    When absent the assertion ref is derived from the key thumbprint alone.
 * @returns LC params on success, or a domain error on failure.
 */
export type GetLcParams = (
  headers: LollipopRequiredHeaders,
  fiscalCode?: FiscalCode,
) => Promise<Result<LcParams, ForbiddenError | GenericError>>;
