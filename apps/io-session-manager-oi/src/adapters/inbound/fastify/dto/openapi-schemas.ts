import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
/**
 * OpenAPI-flavored Zod schemas for the io-example-fastify app. These wrap
 * the runtime Zod value-object schemas with `.meta({ id })` so they appear
 * as named, reusable OpenAPI components in the generated document.
 *
 * The id assigned via `.meta({ id })` becomes both the component name and
 * the `$ref` target in the generated spec.
 */
import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/io-core-domain";
import { z } from "zod";

extendZodWithOpenApi(z);

export const FiscalCodeOpenApi = FiscalCodeSchema.meta({
  description: "The Italian fiscal code (Codice Fiscale).",
  example: "RSSMRA85M01H501U",
  id: "FiscalCode",
});

export const EmailAddressOpenApi = EmailAddressSchema.meta({
  description: "A valid email address.",
  example: "mario.rossi@example.com",
  format: "email",
  id: "EmailAddress",
});

export const NonEmptyStringOpenApi = NonEmptyStringSchema.meta({
  description: "A non-empty string.",
  example: "Mario Rossi",
});

/**
 * Date-encoding helpers used in response schemas.
 * Input: `Date` (use case output) — Output: ISO string (wire format).
 */
const isoDateField = z
  .date()
  .transform((d) => d.toISOString().split("T")[0])
  .meta({
    description: "ISO 8601 date (YYYY-MM-DD).",
    format: "date",
    type: "string",
  });

const isoDateTimeField = z
  .date()
  .transform((d) => d.toISOString())
  .meta({
    description: "ISO 8601 date-time.",
    format: "date-time",
    type: "string",
  });

/**
 * Response schema for `UserProfile`. Input type matches the in-memory
 * `UserProfile` entity (with `Date` fields); output type is the wire shape.
 */
export const UserProfileResponseSchema = z
  .object({
    birthDate: isoDateField,
    createdAt: isoDateTimeField,
    email: EmailAddressOpenApi,
    fiscalCode: FiscalCodeOpenApi,
    name: NonEmptyStringOpenApi,
    updatedAt: isoDateTimeField.optional(),
  })
  .meta({
    description: "A user profile with personal information.",
    id: "UserProfile",
  });

/**
 * Body schema for `POST /api/user-profiles`. `birthDate` is exchanged as an
 * ISO date string and parsed to `Date` so the use case receives
 * `NewUserProfile`.
 */
export const CreateUserProfileBodySchema = z
  .object({
    birthDate: z.iso
      .date()
      .transform((s) => new Date(s))
      .meta({
        description: "The user's date of birth (YYYY-MM-DD).",
        example: "1985-08-01",
        format: "date",
        type: "string",
      }),
    email: EmailAddressOpenApi,
    fiscalCode: FiscalCodeOpenApi,
    name: NonEmptyStringOpenApi,
  })
  .meta({
    description: "Request body for creating a user profile.",
    id: "CreateUserProfileRequest",
  });

export const UpdateUserProfileBodySchema = z
  .object({
    email: EmailAddressOpenApi.optional(),
    name: NonEmptyStringOpenApi.optional(),
  })
  .meta({
    description:
      "Request body for updating a user profile. At least one field should be provided.",
    id: "UpdateUserProfileRequest",
  });

export const FiscalCodeHeaderSchema = z.object({
  "x-fiscal-code": FiscalCodeOpenApi,
});

export const InfoOutputSchema = z
  .object({
    name: z.string().meta({
      description: "The application name.",
      example: "io-example-fastify",
    }),
    version: z
      .string()
      .meta({ description: "The application version.", example: "0.0.1" }),
  })
  .meta({
    description: "Application health and version information.",
    id: "InfoOutput",
  });
