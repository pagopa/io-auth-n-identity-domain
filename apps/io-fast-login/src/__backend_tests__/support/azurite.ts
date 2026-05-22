import { BlobServiceClient } from "@azure/storage-blob";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { fastLoginAuditContainerName } from "./fixtures";

/**
 * Starts the Azurite blob emulator used by backend tests and exposes read-back helpers.
 */
export type BlobSnapshot = {
  readonly body: string;
  readonly name: string;
};

export type AzuriteHarness = {
  readonly blobServiceClient: BlobServiceClient;
  readonly connectionString: string;
  readonly ensureAuditContainer: () => Promise<void>;
  readonly readAuditBlobs: () => Promise<ReadonlyArray<BlobSnapshot>>;
  readonly clearAuditBlobs: () => Promise<void>;
  readonly stop: () => Promise<void>;
};

const azuriteAccountKey =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";
const azuriteAccountName = "devstoreaccount1";
const azuriteImage = "mcr.microsoft.com/azure-storage/azurite";

const readBlobText = async (
  blobServiceClient: BlobServiceClient,
  blobName: string
): Promise<string> => {
  const blobClient = blobServiceClient
    .getContainerClient(fastLoginAuditContainerName)
    .getBlobClient(blobName);

  return (await blobClient.downloadToBuffer()).toString("utf8");
};

const buildConnectionString = (
  host: string,
  blobPort: number,
  queuePort: number,
  tablePort: number
): string =>
  `DefaultEndpointsProtocol=http;AccountName=${azuriteAccountName};AccountKey=${azuriteAccountKey};BlobEndpoint=http://${host}:${blobPort}/${azuriteAccountName};QueueEndpoint=http://${host}:${queuePort}/${azuriteAccountName};TableEndpoint=http://${host}:${tablePort}/${azuriteAccountName};`;

const warmBlobPath = async (
  blobServiceClient: BlobServiceClient
): Promise<void> => {
  const probeContainer = blobServiceClient.getContainerClient(
    `backend-test-probe-${Date.now()}`
  );

  await probeContainer.create();

  try {
    const blobClient = probeContainer.getBlockBlobClient("probe.txt");
    await blobClient.uploadData(Buffer.from("ok", "utf8"));
    const roundTrip = (await blobClient.downloadToBuffer()).toString("utf8");

    if (roundTrip !== "ok") {
      throw new Error("Azurite blob warm-up returned an unexpected payload");
    }
  } finally {
    await probeContainer.delete();
  }
};

export const startAzuriteHarness = async (): Promise<AzuriteHarness> => {
  const container: StartedTestContainer = await new GenericContainer(azuriteImage)
    .withCommand([
      "azurite",
      "--blobHost",
      "0.0.0.0",
      "--blobPort",
      "10000",
      "--queueHost",
      "0.0.0.0",
      "--queuePort",
      "10001",
      "--tableHost",
      "0.0.0.0",
      "--tablePort",
      "10002"
    ])
    .withExposedPorts(10000, 10001, 10002)
    .withWaitStrategy(Wait.forLogMessage("Azurite Blob service is successfully listening"))
    .start();

  const connectionString = buildConnectionString(
    container.getHost(),
    container.getMappedPort(10000),
    container.getMappedPort(10001),
    container.getMappedPort(10002)
  );
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    connectionString
  );

  await warmBlobPath(blobServiceClient);

  return {
    blobServiceClient,
    clearAuditBlobs: async () => {
      const containerClient = blobServiceClient.getContainerClient(
        fastLoginAuditContainerName
      );

      for await (const blob of containerClient.listBlobsFlat()) {
        await containerClient.deleteBlob(blob.name);
      }
    },
    connectionString,
    ensureAuditContainer: async () => {
      await blobServiceClient
        .getContainerClient(fastLoginAuditContainerName)
        .createIfNotExists();
    },
    readAuditBlobs: async () => {
      const containerClient = blobServiceClient.getContainerClient(
        fastLoginAuditContainerName
      );
      const blobNames: Array<string> = [];

      for await (const blob of containerClient.listBlobsFlat()) {
        blobNames.push(blob.name);
      }

      blobNames.sort((left, right) => left.localeCompare(right));

      return Promise.all(
        blobNames.map(async name => ({
          body: await readBlobText(blobServiceClient, name),
          name
        }))
      );
    },
    stop: async () => {
      await container.stop();
    }
  };
};
