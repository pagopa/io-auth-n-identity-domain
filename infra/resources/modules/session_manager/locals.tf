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

    # Redis
    REDIS_URL         = var.redis.hostname
    REDIS_PORT        = var.redis.ssl_port
    REDIS_TLS_ENABLED = "true"
    # REDIS_PASSWORD    = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.sm_redis_access_key.versionless_id})"
    REDIS_PASSWORD = "TODO"
  }
}
