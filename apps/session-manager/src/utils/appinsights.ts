import * as appInsights from "applicationinsights";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { User } from "../types/user";

const SESSION_TRACKING_ID_KEY = "session_tracking_id";
const USER_TRACKING_ID_KEY = "user_tracking_id";

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
    hashFiscalCode(user.fiscal_code),
  );

  if (user.session_tracking_id !== undefined) {
    customProperties.setProperty(
      SESSION_TRACKING_ID_KEY,
      user.session_tracking_id,
    );
  }
}
