import * as dateFns from "date-fns";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { EmailAddress } from "../generated/backend/EmailAddress";
import { toHash } from "./crypto";

/**

 * The identifier for EmailValidationProcessOrchestrator
 *
 * @param fiscalCode the id of the requesting user
 * @param email the user's email
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const makeStartEmailValidationProcessOrchestratorId = (
  fiscalCode: FiscalCode,
  email: EmailAddress,
  creationDate: Date = new Date(),
) =>
  toHash(
    `${dateFns.format(creationDate, "dd/MM/yyyy")}-${fiscalCode}-${email}`,
  );
