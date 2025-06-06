import * as t from "io-ts";

import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";

/**
 * Carries information about created or updated profiles.
 *
 * When oldProfile is defined, the profile has been updated, or it has been
 * created otherwise.
 */
export const UpdatedProfileEvent = t.intersection([
  t.type({
    newProfile: RetrievedProfile,
    updatedAt: t.number,
  }),
  t.partial({
    oldProfile: RetrievedProfile,
  }),
]);

export type UpdatedProfileEvent = t.TypeOf<typeof UpdatedProfileEvent>;
