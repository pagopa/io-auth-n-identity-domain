// OpenAPI generator run with tsx. Route contracts carry their own OpenAPI
// metadata (operationId, summary, tags, …) thanks to the augmentation opted into
// by `src/openapi-metadata.d.ts`, so this script only assembles and writes them.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOpenApiDocument,
  writeOpenApiYaml,
} from "@pagopa/hexagonal-openapi";

import { callbackContract } from "../src/adapters/inbound/fastify/callback.handler.js";
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

const document = buildOpenApiDocument({
  document: {
    info: {
      description:
        "OpenID Connect (OneIdentity) login endpoints exposed by io-session-manager-oi.",
      title: "IO Session Manager OneIdentity API",
      version: packageJson.version,
    },
    servers: [{ url: "https://api-app.io.pagopa.it" }],
  },
  routes: [callbackContract, reserveRoute],
});

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
