# io-web-profile

This repository contains the code of the backend used by the io-web-profile web platform.

## Technologies

[![My Skills](https://skillicons.dev/icons?i=azure,nodejs,ts)](https://skillicons.dev)

This is Node.js Azure Function.

## Prerequisites

In order to run the `io-web-profile` locally you need the following tool installed on your machine.

- `Azure functions core tools`
- `Node.js`
- `pnpm`

The preferred way to set up the local environment is using nodenv to manage Node.js installation and corepack (included with Node.js) to manage the installation of pnpm.

## Structure

The project is structured as follows:

```
io-web-profile
|-- api
|-- Function_01
|   |-- function.json
|-- Function_02
|-- Function_..
|
|-- src
|   |-- utils
|       |-- cosmosdb.ts
|       |-- config.ts
|   |-- Function_01
|       |--__test__
|       |-- handler.ts
|       |-- index.ts
|
|   |-- Function_02
|   |-- Function_..
|
|-- .env
|-- package.json
|-- host.json
|-- local.settings.json
```

- `api`: This folder contain OpenAPI specifications.

- `Function_01/function.json, Function_02/function.json, etc.`: Configuration file specific to Azure Functions. It defines the function's bindings, triggers, and other settings.

- `src` : Contains the project source
  - `Function_01, Function_02, etc.`: These folders represent different functions, they contain the following files:
    - `__ test __`: This folder contain test files.
    - `handler.ts`: File that contains the main logic for the function's execution.
    - `index.ts`: A File that exports the function's handler and is the entry point for the function.
  - `utils`: This folder contains utility files that are likely used across different parts of the project.
    - `cosmosdb.ts`: Contains helper functions to work with Cosmos DB.
    - `config.ts`: Contains configuration settings for the application or service.

- `.env`: Store environment variables that are specific to the backend application.

- `package.json`: Contains metadata about the project as well as dependencies and scripts for building, testing, and running the application.

- `host.json`: Configuration file specific to Azure Functions. It contains global settings and configurations that apply to all functions in the project.

- `local.settings.json`: Configuration file specific to Azure Functions. It contains settings used when running the functions locally, such as local development environment connection strings and other configurations.

## ENV variables

The following table contains the required ENV variables that the function require

| Variable name                        | Description                                              | type                     |
| ------------------------------------ | -------------------------------------------------------- | ------------------------ |
| FF_API_ENABLED                       | Api Auth Mode (NONE, BETA, CANARY, ALL)                  | string                   |
| BETA_TESTERS                         | Beta tester fiscal code separated by comma               | string,string,string,... |
| BEARER_AUTH_HEADER                   | Req Auth Header Param where Bearer token is sotored      | string                   |
| EXCHANGE_JWT_PRIMARY_PUB_KEY         | Exchange JWT Public Key (token validation)               | string                   |
| EXCHANGE_JWT_SECONDARY_PUB_KEY       | (Optional) Exchange JWT Public Key (token validation)    | string                   |
| EXCHANGE_JWT_PRIMARY_PRIVATE_KEY     | Exchange JWT Private Key (token generation)              | string                   |
| EXCHANGE_JWT_ISSUER                  | Exchange JWT ISSUER                                      | string                   |
| EXCHANGE_JWT_TTL                     | Exchange JWT TTL in seconds                              | string                   |
| MAGIC_LINK_JWE_PRIMARY_PUB_KEY       | Magic Link JWE Public Key (token genereation)            | string                   |
| MAGIC_LINK_JWE_SECONDARY_PUB_KEY     | (Optional) Magic Link JWE Private Key (token generation) | string                   |
| MAGIC_LINK_JWE_PRIMARY_PRIVATE_KEY   | Magic Link JWE Private Key (token validation)            | string                   |
| MAGIC_LINK_JWE_SECONDARY_PRIVATE_KEY | (Optional) Magic Link JWE Private Key (token validation) | string                   |
| MAGIC_LINK_JWE_ISSUER                | Magic Link JWE ISSUER                                    | string                   |
| MAGIC_LINK_JWE_TTL                   | Magic Link JWE in seconds                                | string                   |
| MAGIC_LINK_BASE_URL                  | Magic Link baseUrl                                       | string                   |
| HUB_SPID_LOGIN_JWT_PUB_KEY           | Hub Spid Login JWT Public Key (token validation)         | string                   |
| HUB_SPID_LOGIN_JWT_ISSUER            | Hub Spid Login ISSUER                                    | string                   |
| HUB_SPID_LOGIN_CLIENT_BASE_URL       | Hub Spid Login baseUrl                                   | string                   |
| FAST_LOGIN_API_KEY                   | Fast Login Api Key                                       | string                   |
| FAST_LOGIN_CLIENT_BASE_URL           | Fast Login baseUrl                                       | string                   |
| FUNCTIONS_APP_API_KEY                | Io Functions App Api Key                                 | string                   |
| FUNCTIONS_APP_CLIENT_BASE_URL        | Io Functions App baseUrl                                 | string                   |
| AUDIT_LOG_CONNECTION_STRING          | Audit logs blob connection string                        | string                   |
| AUDIT_LOG_CONTAINER                  | Audit logs container                                     | string                   |
| BLACKLISTED_JTI_LIST                 | (Optional) Magic Link IDs blacklist                      | string,string,string,... |
