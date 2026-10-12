# IO Functions for IO App

This project implements the APIs to enable the functionalities implemented in
the IO app. The APIs are called by the app backend.
The implementation is based on the Azure Functions v4 runtime.

## Architecture

The project is structured as follows:

## Contributing

### Setup

Install the [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools).

Install the dependencies:

```bash
$ pnpm install --frozen-lockfile
```

Create a file `local.settings.json` in your cloned repo, with the
following contents:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "WEBSITE_NODE_DEFAULT_VERSION": "22.22.2",
    "AzureWebJobsStorage": "<JOBS_STORAGE_CONNECTION_STRING>",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "<APPINSIGHTS_CONNECTION_STRING>",
    "COSMOSDB_NAME": "<COSMOSDB_DB_NAME>",
    "COSMOSDB_CONNECTION_STRING": "<COSMOSDB_CONNECTION_STRING>",
    "QueueStorageConnection": "<QUEUES_STORAGE_CONNECTION_STRING>",
    "SUBSCRIPTIONS_FEED_TABLE": "SubscriptionsFeedByDay"
  },
  "ConnectionStrings": {}
}
```

### Starting the functions runtime

```
$ pnpm start
```

The server should reload automatically when the code changes.

### Starting the io-functinos-app docker image

If you are trying to run the docker images on your local environment (through the docker-compose) you must set the following variables in the `local.settings.json` file:

- AzureWebJobsStorage
- QueueStorageConnection
  With this **connection string** as value:
- DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;QueueEndpoint=http://azurite:10001/devstoreaccount1;TableEndpoint=http://azurite:10002/devstoreaccount1;

The **connection string** has a default value needed to connect to Azurite, a local emulator used to provide a free local environment for testing an Azure Blob, Queue Storage, and Table Storage application.
As for docker-compose instructions, the Azurite docker image runs the Blob service on port 10000, the Queue service on port 10001 and the Table service on port 10002.
If Azurite is executed on different address or ports, the **connection string** must be changed according to the service.

These must be the other variables values for the `local.settings.json` file:

- COSMOSDB_CONNECTION_STRING=cosmosdb_conn_string
- COSMOSDB_NAME=testdb

Then, copy `.env.example` to `.env` and fill the variables with the following mandatory variables:

- EventsQueueStorageConnection=**connection string**
- MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING=**connection string**

The **connection string** is the same used for the AzureWebJobsStorage in the `local.settings.json` file.

Then you can run `docker-compose up -d` to start the containers.

### Add a new email applier

An email applier is a generated ts file that contains an `apply` function, exposing all the parameters needed by the template. See `loginNotification` as example.
NOTE: The function should return `{{TEMPLATE}}` string, that will be override with the email template.

To create a new email template applier we first need to add the email template to repository [io-app-email-templates](https://github.com/pagopa/io-app-email-templates) and fork it into [io-messages-email-templates](https://github.com/pagopa/io-messages-email-templates).

After the template is ready:

- add new applier template in `_scripts/emailApplierTemplate` folder. It need
- add new `generate:templates:<template_name>` script in package.json. The script needs the following parameters:
  - template name, as defined in `io-messages-email-templates` repo
  - the tag version of `io-messages-email-templates` repo
  - the applier template path
  - the target path of generated code

## Subscription feed recovery

The `RecoverSubscriptionsFeed` Cosmos DB trigger implements **Option 1** of the
recovery RFC (profile-only, retroactive backfill). It listens to the profile
container change feed from `SUBSCRIPTION_FEED_RECOVERY_START_DATE` and filters
documents to the half-open UTC window
`[SUBSCRIPTION_FEED_RECOVERY_START_DATE, SUBSCRIPTION_FEED_RECOVERY_END_DATE)`.
For each fiscal code and UTC day in that window, it starts at most one
`RecoverSubscriptionsFeedOrchestrator`. The orchestrator loads all profile
versions changed on that day, recomputes the final profile-level subscription
feed event (`SUBSCRIBED` or `UNSUBSCRIBED`), and calls the existing
`UpdateSubscriptionFeedActivity` at most once.

Key characteristics:

- **Profile-only**: only `PROFILE` subscription events are emitted;
  service-level entries (`S-*`) are intentionally not touched.
- **Retroactive date**: the activity uses `profile._ts * 1000` as `updatedAt`,
  so the feed entry is backdated to the original profile change.
- **Bounded window**: `SUBSCRIPTION_FEED_RECOVERY_END_DATE` is required, must be
  after the start date, and must not be in the future. Documents outside the
  half-open window are ignored by the trigger. Cosmos DB has no upper-bound
  change-feed option, so disable the trigger with the kill switch after the
  recovery window has been processed.
- **Daily singleton**: the orchestration instance ID is
  `recover-subfeed-<fiscal-code-hash>-<YYYY-MM-DD>-<lease-prefix>`. A running or
  completed instance is not started again; failed or terminated instances can be
  retried. All versions in the day are ordered by profile version and only the
  last effective operation is written to the feed. Because the instance ID ends
  with `SUBSCRIPTION_FEED_RECOVERY_LEASE_PREFIX`, each recovery pass gets its own
  deduplication namespace: changing the prefix replays the whole window from
  scratch.
- **Checkpoint**: the Cosmos DB trigger maintains its own checkpoint in the
  lease container configured via `SUBSCRIPTION_FEED_RECOVERY_LEASE_CONTAINER_NAME`,
  under the lease prefix configured via `SUBSCRIPTION_FEED_RECOVERY_LEASE_PREFIX`,
  so no custom continuation-token store is required. The prefix is a required
  setting and must match `^[A-Za-z0-9_-]+$`.
- **Dry-run**: set `SUBSCRIPTION_FEED_RECOVERY_DRY_RUN=true` to track the
  intended operations without writing to the subscription feed table.
- **Kill switch**: keep the trigger disabled with
  `AzureWebJobs.RecoverSubscriptionsFeed.Disabled=true` until you are ready to
  run the backfill; remove or set to `false` to enable.

Because the orchestrator never throws (failures are tracked as custom events),
a small residual drift is accepted by design.

### Runbook: dry-run pass and real pass

The backfill is executed as **two passes over the same window**: a dry-run pass
that only observes, and a real pass that writes. Each pass needs its **own**
`SUBSCRIPTION_FEED_RECOVERY_LEASE_PREFIX` value, because the prefix drives both
the change feed checkpoint and the orchestration deduplication namespace.

1. **Configure the dry-run pass**, with the trigger still disabled:

   ```dotenv
   SUBSCRIPTION_FEED_RECOVERY_START_DATE=<window start, ISO UTC>
   SUBSCRIPTION_FEED_RECOVERY_END_DATE=<window end, ISO UTC, in the past>
   SUBSCRIPTION_FEED_RECOVERY_LEASE_PREFIX=dryrun-01
   SUBSCRIPTION_FEED_RECOVERY_DRY_RUN=true
   AzureWebJobs.RecoverSubscriptionsFeed.Disabled=true
   ```

2. **Enable the trigger** (`AzureWebJobs.RecoverSubscriptionsFeed.Disabled=false`)
   and wait for the change feed to be fully consumed.

3. **Review the outcome** on Application Insights: `subscriptionFeed.recovery.dryRun`
   gives the operations that would be written, while
   `subscriptionFeed.recovery.failure`, `subscriptionFeed.recovery.badRecord` and
   `subscriptionFeed.recovery.startError` expose the problems to fix before
   writing anything.

4. **Disable the trigger again** (`AzureWebJobs.RecoverSubscriptionsFeed.Disabled=true`).

5. **Configure the real pass**, changing *both* settings:

   ```dotenv
   SUBSCRIPTION_FEED_RECOVERY_LEASE_PREFIX=run-01
   SUBSCRIPTION_FEED_RECOVERY_DRY_RUN=false
   ```

   Changing the prefix is mandatory. Keeping the dry-run value would resume the
   change feed from the dry-run checkpoint (nothing left to read) and, even after
   a replay, every `(fiscal code, day)` pair would be skipped because the
   dry-run orchestrations are already `Completed`.

6. **Enable the trigger**, wait for the window to be consumed, then **disable it
   for good**: Cosmos DB has no upper-bound change feed option, so the kill
   switch is what stops the recovery once the window has been processed.

> **Retrying failures.** A failed recovery is *not* retried by a second pass over
> the same prefix: the orchestrator never throws, so even a logical failure ends
> in the `Completed` runtime status and is treated as an already-processed
> marker. Deleting the lease documents is therefore not a viable recovery
> strategy either — the change feed would be replayed, but every completed
> instance would still be skipped. The backfill is intentionally a **single
> pass**: residual failures are visible through the custom events below and the
> resulting drift is accepted. A full retry requires a brand new pass with a
> different `SUBSCRIPTION_FEED_RECOVERY_LEASE_PREFIX`.

### Custom events

The recovery pipeline emits the following custom events through Application
Insights. All events are unsampled (`samplingEnabled: false`).

#### Trigger level

| Event name | Source | Fired when | Properties |
|---|---|---|---|
| `subscriptionFeed.recovery.badRecord` | `RecoverSubscriptionsFeed` | A document from the profile change feed cannot be decoded as a `RetrievedProfile`. | `kind`: `"DECODE_ERROR"` |
| `subscriptionFeed.recovery.startError` | `RecoverSubscriptionsFeed` | The `RecoverSubscriptionsFeedOrchestrator` could not be started for a valid profile. | `fiscalCode`: hashed fiscal code; `instanceId`: orchestrator instance id; `kind`: `"START_FAILED"`; `version`: profile version as string |

#### Orchestrator level

| Event name | Source | Fired when | Properties |
|---|---|---|---|
| `subscriptionFeed.recovery.failure` | `RecoverSubscriptionsFeedOrchestrator` | A failure happened while reading profile versions or while updating the subscription feed. | `fiscalCode`: hashed fiscal code; `kind`: `"EXCEPTION"` \| `"NOT_FOUND"`; `step`: `"READ_PREVIOUS_VERSION"` \| `"UPDATE_FEED"`; `version`: profile version as string |
| `subscriptionFeed.recovery.dryRun` | `RecoverSubscriptionsFeedOrchestrator` | An operation would be emitted and `dryRun` is enabled, so the activity is skipped and only tracked. | `fiscalCode`: hashed fiscal code; `operation`: `"SUBSCRIBED"` \| `"UNSUBSCRIBED"`; `version`: profile version as string |