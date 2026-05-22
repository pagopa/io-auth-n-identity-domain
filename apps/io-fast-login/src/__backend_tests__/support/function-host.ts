import { once } from "node:events";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as net from "node:net";
import {
  fastLoginAuditContainerName,
  functionsMasterKey,
  lollipopApiKey
} from "./fixtures";
import { readSharedHarnessEnv } from "./shared-harness";

type FunctionHostOptions = {
  readonly lollipopBaseUrl: string;
  readonly sessionManagerBaseUrl?: string;
};

const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
const appInsightsShimPath = fileURLToPath(
  new URL("./noop-appinsights.cjs", import.meta.url)
);
const secretsDir = path.join(appRoot, "Secrets");

const delay = async (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const getAvailablePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a free localhost port"));
        return;
      }

      const { port } = address;
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });

const writeSecretsFile = async (): Promise<void> => {
  await mkdir(secretsDir, { recursive: true });
  await writeFile(
    path.join(secretsDir, "host.json"),
    `${JSON.stringify(
      {
        functionKeys: [],
        masterKey: {
          encrypted: false,
          name: "master",
          value: functionsMasterKey
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
};

const waitUntilReady = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`${baseUrl}/api/info`, {
        signal: AbortSignal.timeout(1000)
      });
      return;
    } catch {
      await delay(500);
    }
  }

  throw new Error("Timed out waiting for the Azure Functions host to respond");
};

/**
 * Starts the real local Azure Functions host against the shared backend-test topology.
 */
export class FunctionHost {
  private child?: ChildProcessWithoutNullStreams;
  private logs = "";
  private port?: number;

  constructor(private readonly options: FunctionHostOptions) {}

  get baseUrl(): string {
    if (!this.port) {
      throw new Error("Function host is not started");
    }

    return `http://127.0.0.1:${this.port}`;
  }

  get xFunctionsKey(): string {
    return functionsMasterKey;
  }

  private buildEnv(): NodeJS.ProcessEnv {
    const harness = readSharedHarnessEnv();

    return {
      ...process.env,
      APPLICATIONINSIGHTS_CONNECTION_STRING:
        "InstrumentationKey=backend-tests;IngestionEndpoint=http://127.0.0.1",
      APPINSIGHTS_DISABLE: "true",
      AzureFunctionsJobHost__Logging__Console__IsEnabled: "true",
      AzureWebJobsSecretStorageType: "files",
      AzureWebJobsStorage: harness.storageConnectionString,
      FAST_LOGIN_AUDIT_CONNECTION_STRING: harness.storageConnectionString,
      FAST_LOGIN_AUDIT_CONTAINER_NAME: fastLoginAuditContainerName,
      FETCH_TIMEOUT_MS: "5000",
      FUNCTIONS_WORKER_RUNTIME: "node",
      LOLLIPOP_GET_ASSERTION_API_KEY: lollipopApiKey,
      LOLLIPOP_GET_ASSERTION_BASE_URL: this.options.lollipopBaseUrl,
      NODE_ENV: "development",
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        `--require=${appInsightsShimPath}`
      ]
        .filter(Boolean)
        .join(" "),
      QueueStorageConnection: harness.storageConnectionString,
      REDIS_PASSWORD: harness.redisPassword,
      REDIS_PORT: String(harness.redisPort),
      REDIS_TLS_ENABLED: "false",
      REDIS_URL: harness.redisHost,
      SESSION_MANAGER_INTERNAL_API_KEY: "unused-session-manager-key",
      SESSION_MANAGER_INTERNAL_BASE_URL:
        this.options.sessionManagerBaseUrl ?? "http://127.0.0.1:65535"
    };
  }

  async start(): Promise<void> {
    if (this.child) {
      return;
    }

    this.port = await getAvailablePort();
    await writeSecretsFile();

    this.child = spawn(
      "func",
      ["start", "--javascript", "--port", String(this.port)],
      {
        cwd: appRoot,
        env: this.buildEnv(),
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    const appendLogs = (chunk: string): void => {
      this.logs += chunk;
      if (this.logs.length > 12_000) {
        this.logs = this.logs.slice(-12_000);
      }
    };

    this.child.stdout.on("data", (chunk: Buffer) => {
      appendLogs(chunk.toString());
    });
    this.child.stderr.on("data", (chunk: Buffer) => {
      appendLogs(chunk.toString());
    });

    try {
      await waitUntilReady(this.baseUrl);
    } catch (error) {
      await this.stop();
      throw new Error(
        `Azure Functions host did not become ready.\n\n${this.logs}`.trim(),
        {
          cause: error
        }
      );
    }
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = undefined;

    if (child) {
      if (child.exitCode === null) {
        child.kill("SIGINT");

        await Promise.race([
          once(child, "exit"),
          (async () => {
            await delay(10_000);
            if (child.exitCode === null) {
              child.kill("SIGKILL");
            }
          })()
        ]);
      }
    }

    await rm(secretsDir, { force: true, recursive: true });
  }
}
