import { NonEmptyStringSchema, ProblemJson } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { ActiveSessionSchema } from "../../../domain/entitites/active-session.entity.js";

export const IntrospectInputDTO = {
  body: z.object({
    token: NonEmptyStringSchema.meta({
      description: "The session token to introspect.",
    }),
  }),
};

export const IntrospectActiveResponseDTO = z
  .object({
    active: z.literal(true).meta({
      description: "Always `true`: the session token is valid.",
    }),
    user: ActiveSessionSchema.meta({
      description: "The user data carried by the session token.",
    }),
  })
  .meta({
    id: "IntrospectActiveResponse",
    description: "Introspection result of a valid session token.",
  });

// `active` has a default so the mapped problem+json is accepted as input and
// is always rendered with `active: false`.
export const IntrospectInactiveResponseDTO = ProblemJson.extend({
  active: z.literal(false).default(false).meta({
    description: "Always `false`: the session token has been invalidated.",
  }),
}).meta({
  id: "IntrospectInactiveResponse",
  description: "Problem details of an invalidated session token.",
});
