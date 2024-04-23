import * as crypto from "crypto";
import * as appInsights from "applicationinsights";
import * as t from "io-ts";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { User } from "../types/user";

const SESSION_TRACKING_ID_KEY = "session_tracking_id";
const USER_TRACKING_ID_KEY = "user_tracking_id";

/**
 * An hashed fiscal code.
 *
 * The fiscal code is used as a tag in the Notification Hub installation,
 * to avoid expose the fiscal code to a third party system we use an hash instead.
 */

const FiscalCodeHash = NonEmptyString;

type FiscalCodeHash = t.TypeOf<typeof FiscalCodeHash>;

/**
 * Compute the sha256 hash of a string.
 */
export const toFiscalCodeHash = (fiscalCode: FiscalCode): FiscalCodeHash => {
  const hash = crypto.createHash("sha256");
  hash.update(fiscalCode);

  return hash.digest("hex") as FiscalCodeHash;
};

/**
 * Attach the userid (CF) hash to the correlation context.
 * Also, if the user objects provides the session_tracking_id property, attach
 * it to the current correlation context.
 * Both the userid hash and the session_tracking_id get propagated to downstream
 * requests.
 *
 * Note that getCorrelationContext() returns an Application Insights context
 * that is scoped on the Express request being handled, thus this function can
 * be safely called within an Express authentication strategy.
 *
 * @see https://github.com/microsoft/ApplicationInsights-node.js/issues/392#issuecomment-387532917
 */
export function attachTrackingData(user: User): void {
  const correlationContext = appInsights.getCorrelationContext();

  // may happen when developing locally
  if (!correlationContext) {
    return;
  }

  const customProperties = correlationContext.customProperties;

  customProperties.setProperty(
    USER_TRACKING_ID_KEY,
    toFiscalCodeHash(user.fiscal_code),
  );

  if (user.session_tracking_id !== undefined) {
    customProperties.setProperty(
      SESSION_TRACKING_ID_KEY,
      user.session_tracking_id,
    );
  }
}
