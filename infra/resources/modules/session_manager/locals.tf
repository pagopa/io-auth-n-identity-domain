locals {
  app_name    = "sm"
  listen_port = 8080

  app_settings = {
    NODE_ENV = "production"

    # The Fastify app reads HOST and PORT directly from env
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

    # Lollipop service
    LOLLIPOP_API_URL       = var.lollipop.base_url
    LOLLIPOP_API_BASE_PATH = var.lollipop.base_path
    # LOLLIPOP_API_KEY       = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.sm_lollipop_api_key.versionless_id})"
    LOLLIPOP_API_KEY = "TODO"

    # Profile service
    IO_PROFILE_API_URL       = var.io_profile.base_url
    IO_PROFILE_API_BASE_PATH = var.io_profile.base_path
    # IO_PROFILE_API_KEY       = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.sm_io_profile_api_key.versionless_id})"
    IO_PROFILE_API_KEY = "TODO"

    # Fast Login service
    IO_FAST_LOGIN_API_URL       = var.io_fast_login.base_url
    IO_FAST_LOGIN_API_BASE_PATH = var.io_fast_login.base_path
    # IO_FAST_LOGIN_API_KEY       = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.sm_io_fast_login_api_key.versionless_id})"
    IO_FAST_LOGIN_API_KEY = "TODO"

    # Locked Profiles table
    LOCKED_PROFILES_STORAGE_ACCOUNT_URI = "https://${var.locked_profiles.storage_account.name}.table.core.windows.net"
    LOCKED_PROFILES_TABLE_NAME          = var.locked_profiles.table_name

    # Session Manager Internal service
    IO_SM_INT_API_URL       = var.io_session_manager_internal.base_url
    IO_SM_INT_API_BASE_PATH = var.io_session_manager_internal.base_path
    # IO_SM_INT_API_KEY       = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.sm_io_sm_int_api_key.versionless_id})"
    IO_SM_INT_API_KEY = "TODO"

    # IO-Communication notification queue
    PUSH_NOTIFICATIONS_QUEUE_STORAGE_URI = data.azurerm_storage_account.io_com.primary_queue_endpoint
    PUSH_NOTIFICATIONS_QUEUE_NAME        = data.azurerm_storage_queue.push_notifications.name

    # Redis
    # Authentication is Microsoft Entra ID only (no access key): the CA's
    # system-assigned identity is granted data-plane access via `ca_iam`.
    REDIS_HOSTNAME    = split(":", module.managed_redis.endpoint)[0]
    REDIS_PORT        = split(":", module.managed_redis.endpoint)[1]
    REDIS_TLS_ENABLED = "true"

    # Session Cosmos DB (io-auth-SM) - accessed via managed identity
    COSMOSDB_URI                           = var.session_cosmos.account_uri
    COSMOSDB_NAME                          = azurerm_cosmosdb_sql_database.session_manager.name
    COSMOSDB_SESSION_TOKEN_CONTAINER_NAME  = azurerm_cosmosdb_sql_container.session_tokens.name
    COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME = azurerm_cosmosdb_sql_container.active_sessions.name

    # One Identity configs
    ONEID_PROD_CLIENT_ID = "4HWHRx-Wv19-cY-YL6Q1AgYVvx3h0Gw_SvtayZWJVVE"
    ONEID_PROD_ISSUER    = "https://io.oneid.pagopa.it"
    # TODO: change me with actual prod callback (mocked with localhost for URL
    # constructor pass)
    ONEID_PROD_REDIRECT_URI = "http://localhost/callback"
    # ONEID_PROD_CLIENT_SECRET is injected via the CA module's `secrets`

    ONEID_UAT_CLIENT_ID = "XbFEUWXdvQGOU1usvMURZv4YWQjYFS0ggAk0xyFCEKc"
    ONEID_UAT_ISSUER    = "https://uat.io.oneid.pagopa.it"
    # ONEID_UAT_CLIENT_SECRET is injected via the CA module's `secrets`

    AUTH_SESSIONS_TOPIC_NAME = var.service_bus.auth_session_topic_name
    SERVICE_BUS_HOSTNAME     = var.service_bus.hostname
  }
}
