# IO Session Manager

## Table of content

<!-- TOC start -->

- [IO Session Manager](#io-session-manager)
  - [Table of content](#table-of-content)
  - [Authentication process](#authentication-process)
    - [User authentication](#user-authentication)
    - [Token authentication](#token-authentication)
  - [How to run the application](#how-to-run-the-application)
    - [Dependencies](#dependencies)
    - [Installation steps](#installation-steps)
    - [SPID user management](#spid-user-management)
    - [Generate SAML (SPID) certs (development)](#generate-saml-spid-certs-development)

## <!-- TOC end -->

## Authentication process

The `io-app` application will authenticate to the backend in two steps:

1. an initial user initiated SPID authentication process (SAML2 based)
   that identifies the user and, on success, triggers the creation of a new
   authentication session (associated to a session token)
2. subsequent requests to the backend will be authenticated via a bearer session token

### User authentication

When a client (the mobile app or a browser) wants to login with the backend it will call the `/api/auth/v1/login` endpoint with the
IDP entityID as parameter in the query string. The backend will then builds an authorization URL and performs a redirect
to the chosen IDP. The authentication process will continue to the IDP website. If the authentication process ends with
success the IDP will redirect the client to an HTML page with a form that will auto-post itself to the
`/assertionConsumerService` (mapped internally to `api/auth/v1/assertionConsumerService`) endpoint with a SAMLResponse as an hidden field. The backend will parse and validate the
SAMLResponse to extract all the user attributes (fiscal code, first name, last name, email and birthdate), then it will generates an
unique alphanumeric string as token and saves an User object to the `RedisSessionStorage` service using the token as key.
Finally the backend will redirect the client to the value of the environment variable `CLIENT_REDIRECTION_URL` with the
token in the query string. The client must saves the token and use it in all API request.

The code that manage this flow are in the `io-spid-commons` package (more info
[here](https://github.com/pagopa/io-spid-commons)), and in the `src/strategies/spidStrategy.ts` and
`src/controllers/authenticationController.ts` files.

### Token authentication

All API requests sent by the client to the backend must have an `Authorization: Bearer` header or a `token` query param with the value of the token obtained from the SPID authentication process. The token is used to retrieve the User object from the
`RedisSessionStorage` service.

The code that manage this flow are in the `src/strategies/session-token-strategy.ts` file.

## How to run the application

### Dependencies

- [Docker](https://www.docker.com/) and [Docker Compose](https://github.com/docker/compose)

To fully simulate the SPID authentication process we use the images provided by the
[spid-testenv2](https://github.com/italia/spid-testenv2) project.

A Linux/macOS environment is required at the moment.

### Installation steps

1. clone the project
2. go to the project's folder
3. generate a new keypair for spid like described in [here](#generate-saml-spid-certs-development)
4. launch the docker compose with `docker compose up -d` to start the containers
5. point your browser to [http://localhost:8081/metadata](http://localhost:8081/metadata) and copy the source of the page to a new `docker/testenv2/conf/sp_metadata.xml` file
6. run `docker-compose up -d` again to restart the containers
7. point your browser to [http://localhost:8081/login](http://localhost:8081/login?entityID=xx_testenv2&authLevel=SpidL2) to execute a test login

### SPID user management

The setup procedure adds some test users to the test IDP server, the full list could be retrieved in
`testenv2/conf/users.json`. To add more users simply add more items to this file and restart the `spid-testenv2` container.

### Generate SAML (SPID) certs (development)

The backend implements a SAML Service Provider - for authenticating the clients it needs a certificate that you can generate with the following command (you need to have `openssl` available in your path):

```
$ pnpm --filter @pagopa/io-session-manager generate:test-certs
```
