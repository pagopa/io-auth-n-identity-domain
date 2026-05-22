import * as http from "node:http";
import { once } from "node:events";
import * as net from "node:net";

type RecordedRequest = {
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly path: string;
};

const getAvailablePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a free port for the Lollipop stub"));
        return;
      }

      server.close(error => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });

const normalizeHeaders = (
  headers: http.IncomingHttpHeaders
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => value !== undefined)
      .map(
        ([key, value]) =>
          [key, Array.isArray(value) ? value.join(",") : value] as [
            string,
            string
          ]
      )
      .sort(([left], [right]) => left.localeCompare(right))
  );

/**
 * Hosts the deterministic downstream Lollipop exchange observed by the fast-login scenarios.
 */
export class LollipopStub {
  private readonly requests: Array<RecordedRequest> = [];
  private server?: http.Server;
  private port?: number;

  constructor(private readonly samlResponse: string) {}

  get baseUrl(): string {
    if (!this.port) {
      throw new Error("Lollipop stub is not started");
    }

    return `http://127.0.0.1:${this.port}`;
  }

  get recordedRequests(): ReadonlyArray<RecordedRequest> {
    return [...this.requests];
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.port = await getAvailablePort();
    this.server = http.createServer((request, response) => {
      this.requests.push({
        headers: normalizeHeaders(request.headers),
        method: request.method ?? "GET",
        path: request.url ?? "/"
      });

      if (
        request.method === "GET" &&
        request.url?.includes("/assertions/")
      ) {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            response_xml: this.samlResponse
          })
        );
        return;
      }

      response.statusCode = 404;
      response.end(
        JSON.stringify({
          status: 404,
          title: "Not Found"
        })
      );
    });

    this.server.listen(this.port, "127.0.0.1");
    await once(this.server, "listening");
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = undefined;
    this.port = undefined;
    this.requests.length = 0;

    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}
