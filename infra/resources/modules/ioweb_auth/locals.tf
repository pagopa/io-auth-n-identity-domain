locals {
  app_name      = "ioweb-auth"
  auth_ca_image = "ghcr.io/pagopa/io-web-auth-service"

  listen_port = 8080

  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    },
    # The Fastify app reads HOST and PORT directly from env
    {
      name  = "HOST"
      value = "0.0.0.0"
    },
    {
      name  = "PORT"
      value = tostring(local.listen_port)
    },
    {
      name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
      value = azurerm_key_vault_secret.auth_application_insights_connection_string.versionless_id
    },
    {
      name  = "APPLICATIONINSIGHTS_ENTRA_ID_AUTH_ENABLED"
      value = "true"
    },
    {
      name  = "APPLICATIONINSIGHTS_CONFIGURATION_FILE"
      value = "/app/applicationinsights.json"
    },
    #Low-request service
    {
      name  = "APPINSIGHTS_SAMPLING_PERCENTAGE"
      value = "100"
    },
    # Values aligned with the WEU session-manager configuration.
    {
      name  = "FETCH_KEEPALIVE_ENABLED"
      value = "true"
    },
    {
      name  = "FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL"
      value = "110000"
    },
    {
      name  = "FETCH_KEEPALIVE_MAX_SOCKETS"
      value = "128"
    },
    {
      name  = "FETCH_KEEPALIVE_MAX_FREE_SOCKETS"
      value = "10"
    },
    {
      name  = "FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT"
      value = "30000"
    },
    {
      name  = "FETCH_KEEPALIVE_TIMEOUT"
      value = "60000"
    },
    # Redis
    # Authentication is Microsoft Entra ID only (no access key): the CA's
    # system-assigned identity is granted data-plane access via `auth_ca_iam`.
    {
      name  = "REDIS_HOSTNAME"
      value = split(":", module.managed_redis.endpoint)[0]
    },
    {
      name  = "REDIS_PORT"
      value = split(":", module.managed_redis.endpoint)[1]
    },
    {
      name  = "REDIS_TLS_ENABLED"
      value = "true"
    },
    # One Identity configs
    {
      name  = "ONEID_PROD_CLIENT_ID"
      value = azurerm_key_vault_secret.oneid_prod_client_id.versionless_id
    },
    {
      name  = "ONEID_PROD_CLIENT_SECRET"
      value = azurerm_key_vault_secret.oneid_prod_client_secret.versionless_id
    },
    {
      name  = "ONEID_PROD_ISSUER"
      value = "https://oneid.pagopa.it"
    },
    {
      name  = "ONEID_PROD_REDIRECT_URI"
      value = "https://api-web.io.pagopa.it/ioweb/auth/v2/callback"
    },
    {
      name  = "ONEID_UAT_CLIENT_ID"
      value = azurerm_key_vault_secret.oneid_uat_client_id.versionless_id
    },
    {
      name  = "ONEID_UAT_CLIENT_SECRET"
      value = azurerm_key_vault_secret.oneid_uat_client_secret.versionless_id
    },
    {
      name  = "ONEID_UAT_ISSUER"
      value = "https://uat.oneid.pagopa.it"
    },
  ]
}
