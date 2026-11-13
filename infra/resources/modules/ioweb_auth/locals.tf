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
  ]
}
