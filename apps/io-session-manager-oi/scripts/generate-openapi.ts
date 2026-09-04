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
import { reserveRoute } from "../src/adapters/inbound/fastify/reserve.handler.js";
import { ssoBpdUserRoute } from "../src/adapters/inbound/fastify/sso-bpd-user.handler.js";

interface PackageJson {
  version: string;
}

const packageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../package.json", import.meta.url)),
    "utf8",
  ),
) as PackageJson;

const check = process.argv.includes("--check");

const SSO_BPD_BASE_PATH = "/sso/bpd/v2";

interface DocumentSpec {
  readonly basePath: string;
  readonly description: string;
  readonly outputRelPath: string;
  readonly routes: ReadonlyArray<AnyRouteContract>;
  readonly tags: ReadonlyArray<{ name: string; description: string }>;
  readonly title: string;
}

const stripBasePath =
  (basePath: string) =>
  (route: AnyRouteContract): AnyRouteContract => {
    if (!route.path.startsWith(basePath)) {
      throw new Error(
        `Route path "${route.path}" must start with basePath "${basePath}" so it can be moved onto the server URL.`,
      );
    }

    return {
      ...route,
      path: route.path.slice(basePath.length) || "/",
    };
  };

const generate = async (spec: DocumentSpec): Promise<boolean> => {
  const outputPath = fileURLToPath(
    new URL(`../${spec.outputRelPath}`, import.meta.url),
  );

  const document = {
    ...buildOpenApiDocument({
      document: {
        info: {
          description: spec.description,
          title: spec.title,
          version: packageJson.version,
        },
        servers: [{ url: `https://api-app.io.pagopa.it${spec.basePath}` }],
        tags: [...spec.tags],
      },
      routes: spec.routes.map(stripBasePath(spec.basePath)),
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
    return false;
  }

  console.log(`OpenAPI spec ${result.kind}: ${result.path}`);
  return true;
};

const specs: ReadonlyArray<DocumentSpec> = [
  {
    basePath: BASE_PATH,
    description:
      "OpenID Connect (OneIdentity) login endpoints exposed by io-session-manager-oi.",
    outputRelPath: "api/external.yaml",
    routes: [callbackContract, reserveRoute],
    tags: [
      {
        name: "oidc",
        description:
          "Operations that take part in the OpenID Connect authorization flow.",
      },
    ],
    title: "IO Session Manager OneIdentity API",
  },
  {
    basePath: SSO_BPD_BASE_PATH,
    description:
      "BPD SSO endpoints exposed by io-session-manager-oi. Access is restricted to the configured source IP allowlist.",
    outputRelPath: "api/sso/bpd.yaml",
    routes: [ssoBpdUserRoute],
    tags: [
      {
        name: "sso",
        description:
          "Single Sign-On endpoints consumed by downstream backends (BPD).",
      },
    ],
    title: "IO Session Manager OneIdentity — BPD SSO API",
  },
];

const results = await Promise.all(specs.map(generate));

if (results.some((ok) => !ok)) {
  process.exit(1);
}
