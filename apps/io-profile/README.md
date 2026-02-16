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
    "WEBSITE_NODE_DEFAULT_VERSION": "20.19.5",
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
