/* eslint-disable no-console */

// OpenAPI generator run with tsx. Route contracts carry their own OpenAPI
// metadata (operationId, summary, tags, …), so this script only assembles and
// writes them.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type AnyRouteContract,
  buildOpenApiDocument,
  writeOpenApiYaml,
} from "@pagopa/hexagonal-openapi";

import { BASE_PATH } from "../src/adapters/inbound/base-path.js";
import { callbackContract } from "../src/adapters/inbound/fastify/callback.handler.js";
import { getSessionContract } from "../src/adapters/inbound/fastify/get-session.handler.js";
import { reserveRoute } from "../src/adapters/inbound/fastify/reserve.handler.js";

interface PackageJson {
  version: string;
}

const packageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../package.json", import.meta.url)),
    "utf8",
  ),
) as PackageJson;

const openApiPath = fileURLToPath(
  new URL("../api/external.yaml", import.meta.url),
);

const toOpenApiRoute = (route: AnyRouteContract): AnyRouteContract => {
  if (!route.path.startsWith(BASE_PATH)) {
    throw new Error(
      `Route path "${route.path}" must start with BASE_PATH "${BASE_PATH}" so it can be moved onto the server URL.`,
    );
  }

  return {
    ...route,
    path: route.path.slice(BASE_PATH.length) || "/",
  };
};

const document = {
  ...buildOpenApiDocument({
    document: {
      info: {
        description:
          "OpenID Connect (OneIdentity) login endpoints exposed by io-session-manager-oi.",
        title: "IO Session Manager OneIdentity API",
        version: packageJson.version,
      },
      servers: [{ url: `https://api-app.io.pagopa.it${BASE_PATH}` }],
      tags: [
        {
          name: "oidc",
          description:
            "Operations that take part in the OpenID Connect authorization flow.",
        },
      ],
    },
    routes: [callbackContract, reserveRoute, getSessionContract].map(
      toOpenApiRoute,
    ),
  }),
  webhooks: undefined, // The OpenAPI spec is generated from the route contracts, which do not declare any webhooks. Therefore, the `webhooks` property is set to `undefined` to avoid generating an empty object in the OpenAPI spec, which causes the OpenAPI import to fail in the Azure API Management service.
};

const check = process.argv.includes("--check");

if (!check) {
  mkdirSync(dirname(openApiPath), { recursive: true });
}

const result = await writeOpenApiYaml({
  check,
  doc: document,
  path: openApiPath,
});

if (result.kind === "check-failed") {
  console.error(
    "OpenAPI spec is out of date. Regenerate it with `pnpm openapi:generate`.",
  );
  console.error(result.diff);
  process.exit(1);
}

console.log(`OpenAPI spec ${result.kind}: ${result.path}`);
