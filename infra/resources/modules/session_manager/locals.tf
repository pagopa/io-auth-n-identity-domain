locals {
  app_name = "sm"
  # The Fastify app reads HOST and PORT directly from env, therefore we
  # explicitly bind on all interfaces on port 8080 (aligned with the
  # `WEBSITES_PORT` default used by the Linux App Service runtime).
  listen_port = "8080"

  app_settings = {
    NODE_ENV = "production"

    HOST = "0.0.0.0"
    PORT = local.listen_port

    # Values aligned with the
    # WEU session-manager configuration.
    FETCH_KEEPALIVE_ENABLED             = "true"
    FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
    FETCH_KEEPALIVE_MAX_SOCKETS         = "128"
    FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
    FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
    FETCH_KEEPALIVE_TIMEOUT             = "60000"

    # Lollipop function
    # LOLLIPOP_API_URL       = "https://${module.function_lollipop.function_app.function_app.default_hostname}"
    # LOLLIPOP_API_BASE_PATH = "/api/v1"
    # LOLLIPOP_API_KEY       = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.session_manager_oi_lollipop_api_key.versionless_id})"
  }
}
