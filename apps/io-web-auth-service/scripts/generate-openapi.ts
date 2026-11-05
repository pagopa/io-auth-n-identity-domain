/* eslint-disable no-console */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type AnyRouteContract,
  buildOpenApiDocument,
  writeOpenApiYaml,
} from "@pagopa/hexagonal-openapi";

const check = process.argv.includes("--check");
const outputPath = fileURLToPath(
  new URL("../api/external.yaml", import.meta.url),
);

const routes: ReadonlyArray<AnyRouteContract> = [];

const document = {
  ...buildOpenApiDocument({
    document: {
      info: {
        title: "IO Web Auth Service API",
        version: "0.1.0",
        description:
          "OpenID Connect (OneIdentity) login endpoints exposed by io-web-auth-service.",
      },
      servers: [{ url: "https://api-app.internal.io.pagopa.it/ioweb/auth/v2" }],
    },
    routes,
  }),
  webhooks: undefined, // Route contracts declare no webhooks; keep the key absent so APIM import doesn't reject an empty object.
};

if (!check) {
  mkdirSync(dirname(outputPath), { recursive: true });
}

const result = await writeOpenApiYaml({
  check,
  doc: document,
  path: outputPath,
});

if (result.kind === "check-failed") {
  console.error(
    `OpenAPI spec is out of date: ${outputPath}. Regenerate it with \`pnpm openapi:generate\`.`,
  );
  console.error(result.diff);
  process.exitCode = 1;
} else {
  console.log(`OpenAPI spec ${result.kind}: ${result.path}`);
}
