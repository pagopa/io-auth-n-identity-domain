import { defineConfig } from "@hey-api/openapi-ts";
import { FiscalCodeSchema } from "@pagopa/hexagonal-core";

export default defineConfig({
  input:
    "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/6da6a1d6628778db9325c48e9bfdd9968a3369ee/apps/io-profile/api/index.yaml",
  output: {
    path: "src/generated/io-profile",
    module: {
      extension: ".js",
    },
  },
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/schemas",
    "@hey-api/sdk",
    {
      name: "zod",
      $resolvers: {
        // Intercept all string nodes
        string(ctx) {
          const { $, schema } = ctx;

          if (
            (schema.pattern &&
              FiscalCodeSchema._zod.pattern
                .toString()
                .includes(schema.pattern)) ||
            schema.format == "FiscalCode"
          ) {
            const customSchemaSymbol = ctx.plugin.symbolFactory.register(
              "FiscalCodeSchema",
              {
                external: "@pagopa/hexagonal-core",
              },
            );

            return $(customSchemaSymbol);
          }

          if (schema.format == "email") {
            const customSchemaSymbol = ctx.plugin.symbolFactory.register(
              "EmailAddressSchema",
              {
                external: "@pagopa/hexagonal-core",
              },
            );

            return $(customSchemaSymbol);
          }
        },
      },
    },
    {
      enums: "javascript",
      name: "@hey-api/typescript",
    },
  ],
});
