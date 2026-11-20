import { defineConfig, UserConfig } from "@hey-api/openapi-ts";
import { FiscalCodeSchema } from "@pagopa/hexagonal-core";

const stringResolver = (ctx: {
  $: (symbol: unknown) => unknown;
  plugin: {
    symbolFactory: {
      register: (name: string, options: { external: string }) => unknown;
    };
  };
  schema: { format?: string; pattern?: string };
}) => {
  const { $, schema } = ctx;

  if (
    (schema.pattern &&
      FiscalCodeSchema._zod.pattern.toString().includes(schema.pattern)) ||
    schema.format === "FiscalCode"
  ) {
    const customSchemaSymbol = ctx.plugin.symbolFactory.register(
      "FiscalCodeSchema",
      {
        external: "@pagopa/hexagonal-core",
      },
    );

    return $(customSchemaSymbol);
  }

  if (schema.format === "email") {
    const customSchemaSymbol = ctx.plugin.symbolFactory.register(
      "EmailAddressSchema",
      {
        external: "@pagopa/hexagonal-core",
      },
    );

    return $(customSchemaSymbol);
  }
};

export default defineConfig([
  {
    input:
      "https://raw.githubusercontent.com/pagopa/io-infra/702da5fed9986814e1e19720b04359d73774b34f/src/common/_modules/platform_api_gateway/api/platform-internal/v1/api.yaml",
    output: {
      path: "src/generated/platform-internal",
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
          string: stringResolver,
        },
      },
      {
        enums: "javascript",
        name: "@hey-api/typescript",
      },
    ],
  },
] as ReadonlyArray<UserConfig>);
