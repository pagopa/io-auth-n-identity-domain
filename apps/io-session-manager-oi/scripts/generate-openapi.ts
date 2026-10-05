/* eslint-disable no-console */

// OpenAPI generator run with tsx. Route contracts carry their own OpenAPI
// metadata (operationId, summary, tags, …), so this script only assembles and
// writes them.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type AnyRouteContract,
  buildOpenApiDocument,
  writeOpenApiYaml,
} from "@pagopa/hexagonal-openapi";

import {
  BASE_PATH,
  SSO_BPD_BASE_PATH,
  SSO_FIMS_BASE_PATH,
  SSO_PAGOPA_BASE_PATH,
  SSO_ZENDESK_BASE_PATH,
} from "../src/adapters/inbound/base-path.js";
import { callbackContract } from "../src/adapters/inbound/fastify/callback.handler.js";
import { getSessionContract } from "../src/adapters/inbound/fastify/get-session.handler.js";
import { reserveRoute } from "../src/adapters/inbound/fastify/reserve.handler.js";
import { ssoBpdUserRoute } from "../src/adapters/inbound/fastify/sso-bpd-user.handler.js";
import { ssoFimsLollipopUserRoute } from "../src/adapters/inbound/fastify/sso-fims-lollipop-user.handler.js";
import { ssoFimsUserRoute } from "../src/adapters/inbound/fastify/sso-fims-user.handler.js";
import { ssoPagopaUserRoute } from "../src/adapters/inbound/fastify/sso-pagopa-user.handler.js";
import { ssoZendeskTokenRoute } from "../src/adapters/inbound/fastify/sso-zendesk-token.handler.js";

const check = process.argv.includes("--check");

type ContentType = "application/json" | "application/x-www-form-urlencoded";
const DEFAULT_CONTENT_TYPE: ContentType = "application/json";

interface Route {
  readonly contract: AnyRouteContract;
  readonly requestBodyContentType?: ContentType;
}

interface DocumentSpec {
  readonly basePath: string;
  readonly description: string;
  readonly outputRelPath: string;
  readonly routes: ReadonlyArray<Route>;
  readonly tags: ReadonlyArray<{ name: string; description: string }>;
  readonly title: string;
  readonly version: string;
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
          version: spec.version,
        },
        servers: [{ url: `https://api-app.io.pagopa.it${spec.basePath}` }],
        tags: [...spec.tags],
      },
      registerComponents: (registry) => {
        registry.registerComponent("securitySchemes", "bearerAuth", {
          type: "http",
          scheme: "bearer",
          bearerFormat: "opaque",
          description:
            "Enter the opaque token provided by the authentication authority",
        });
      },
      routes: spec.routes.map(({ contract }) =>
        stripBasePath(spec.basePath)(contract),
      ),
    }),
    webhooks: undefined, // Route contracts declare no webhooks; keep the key absent so APIM import doesn't reject an empty object.
  };

  const documentWithRequestBodies = document as unknown as {
    paths?: Record<
      string,
      Record<string, { requestBody?: { content?: Record<string, unknown> } }>
    >;
  };

  for (const route of spec.routes) {
    const requestBodyContentType: ContentType =
      route.requestBodyContentType ?? DEFAULT_CONTENT_TYPE;
    if (requestBodyContentType === DEFAULT_CONTENT_TYPE) {
      continue;
    }

    const routePath = stripBasePath(spec.basePath)(route.contract).path;
    const operation =
      documentWithRequestBodies.paths?.[routePath]?.[
        route.contract.method.toLowerCase()
      ];
    const content = operation?.requestBody?.content;
    const requestSchema = content?.[DEFAULT_CONTENT_TYPE];

    if (!content || requestSchema === undefined) {
      throw new Error(
        `Route "${routePath}" (${route.contract.method}) has no generated ${DEFAULT_CONTENT_TYPE} request body to convert.`,
      );
    }

    delete content[DEFAULT_CONTENT_TYPE];
    content[requestBodyContentType] = requestSchema;
  }

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
    routes: [
      { contract: callbackContract },
      { contract: reserveRoute },
      { contract: getSessionContract },
    ],
    tags: [
      {
        name: "oidc",
        description:
          "Operations that take part in the OpenID Connect authorization flow.",
      },
    ],
    title: "IO Session Manager OneIdentity API",
    version: "0.23.1",
  },
  {
    basePath: SSO_BPD_BASE_PATH,
    description:
      "BPD SSO endpoints exposed by io-session-manager-oi. Access is restricted to the configured source IP allowlist.",
    outputRelPath: "api/sso/bpd.yaml",
    routes: [{ contract: ssoBpdUserRoute }],
    tags: [
      {
        name: "sso",
        description: "BPD Single Sign-On endpoints.",
      },
    ],
    title: "Bonus Pagamenti Digitali API for user authentication.",
    version: "0.23.1",
  },
  {
    basePath: SSO_FIMS_BASE_PATH,
    description:
      "FIMS SSO endpoints exposed by io-session-manager-oi. Access is restricted to the configured source IP allowlist.",
    outputRelPath: "api/sso/fims.yaml",
    routes: [
      { contract: ssoFimsUserRoute },
      { contract: ssoFimsLollipopUserRoute },
    ],
    tags: [
      {
        name: "sso",
        description: "FIMS Single Sign-On endpoints.",
      },
    ],
    title: "FIMS API for user authentication.",
    version: "0.23.1",
  },
  {
    basePath: SSO_PAGOPA_BASE_PATH,
    description:
      "PagoPA SSO endpoints exposed by io-session-manager-oi. Access is restricted to the configured source IP allowlist.",
    outputRelPath: "api/sso/pagopa.yaml",
    routes: [{ contract: ssoPagopaUserRoute }],
    tags: [
      {
        name: "sso",
        description: "PagoPA Single Sign-On endpoints.",
      },
    ],
    title: "PagoPA API for user authentication.",
    version: "0.23.1",
  },
  {
    basePath: SSO_ZENDESK_BASE_PATH,
    description:
      "Zendesk SSO endpoints exposed by io-session-manager-oi. Access is restricted to the configured source IP allowlist.",
    outputRelPath: "api/sso/zendesk.yaml",
    routes: [
      {
        contract: ssoZendeskTokenRoute,
        requestBodyContentType: "application/x-www-form-urlencoded",
      },
    ],
    tags: [
      {
        name: "sso",
        description: "Zendesk Single Sign-On endpoints.",
      },
    ],
    title: "Zendesk API for user authentication.",
    version: "0.23.1",
  },
];

const results = await Promise.all(specs.map(generate));

if (results.some((ok) => !ok)) {
  process.exit(1);
}
