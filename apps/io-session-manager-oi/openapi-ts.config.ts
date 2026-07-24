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
};

export default defineConfig([
  {
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
          string: stringResolver,
        },
      },
      {
        enums: "javascript",
        name: "@hey-api/typescript",
      },
    ],
  },
  {
    input:
      "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/71cba5610a1e7b59bb9c60140a26c924c0edf220/apps/io-lollipop/api/internal.yaml",
    output: {
      path: "src/generated/io-lollipop",
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
  {
    input:
      "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/42e4199865414dd631016a3e6c984ad2e0aef1fc/apps/io-session-manager-internal/api/internal.yaml",
    output: {
      path: "src/generated/io-session-manager-internal",
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
