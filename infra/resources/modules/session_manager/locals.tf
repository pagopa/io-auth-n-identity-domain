locals {
  app_name    = "sm"
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
    # Lollipop service
    {
      name  = "LOLLIPOP_API_URL"
      value = var.lollipop.base_url
    },
    {
      name  = "LOLLIPOP_API_BASE_PATH"
      value = var.lollipop.base_path
    },
    {
      name  = "LOLLIPOP_API_KEY"
      value = azurerm_key_vault_secret.sm_lollipop_api_key.versionless_id
    },
    {
      name  = "LOLLIPOP_REVOCATION_QUEUE_STORAGE_URI"
      value = "https://${var.lollipop.storage_account.name}.queue.core.windows.net"
    },
    {
      name  = "LOLLIPOP_REVOCATION_QUEUE_NAME"
      value = var.lollipop.revocation_queue_name
    },
    # Profile service
    {
      name  = "IO_PROFILE_API_URL"
      value = var.io_profile.base_url
    },
    {
      name  = "IO_PROFILE_API_BASE_PATH"
      value = var.io_profile.base_path
    },
    {
      name  = "IO_PROFILE_API_KEY"
      value = azurerm_key_vault_secret.sm_io_profile_api_key.versionless_id
    },
    # Fast Login service
    {
      name  = "IO_FAST_LOGIN_API_URL"
      value = var.io_fast_login.base_url
    },
    {
      name  = "IO_FAST_LOGIN_API_BASE_PATH"
      value = var.io_fast_login.base_path
    },
    {
      name  = "IO_FAST_LOGIN_API_KEY"
      value = azurerm_key_vault_secret.sm_io_fast_login_api_key.versionless_id
    },
    # Locked Profiles table
    {
      name  = "LOCKED_PROFILES_STORAGE_ACCOUNT_URI"
      value = "https://${var.locked_profiles.storage_account.name}.table.core.windows.net"
    },
    {
      name  = "LOCKED_PROFILES_TABLE_NAME"
      value = var.locked_profiles.table_name
    },
    # Technical Locked Profiles table
    {
      name  = "TECHNICAL_LOCKED_PROFILES_STORAGE_ACCOUNT_URI"
      value = "https://${var.technical_locked_profiles.storage_account.name}.table.core.windows.net"
    },
    {
      name  = "TECHNICAL_LOCKED_PROFILES_TABLE_NAME"
      value = var.technical_locked_profiles.table_name
    },
    # Session Manager Internal service
    {
      name  = "IO_SM_INT_API_URL"
      value = var.io_session_manager_internal.base_url
    },
    {
      name  = "IO_SM_INT_API_BASE_PATH"
      value = var.io_session_manager_internal.base_path
    },
    # {
    #   name  = "IO_SM_INT_API_KEY"
    #   value = azurerm_key_vault_secret.sm_io_sm_int_api_key.versionless_id
    # },
    {
      name  = "IO_SM_INT_API_KEY"
      value = "TODO"
    },
    # Platform Proxy Internal API
    {
      name  = "PLATFORM_PROXY_API_URL"
      value = var.platform_proxy.base_url
    },
    {
      name  = "PLATFORM_PROXY_API_BASE_PATH"
      value = var.platform_proxy.base_path
    },
    # IO-Communication notification queue
    {
      name  = "PUSH_NOTIFICATIONS_QUEUE_STORAGE_URI"
      value = data.azurerm_storage_account.io_com.primary_queue_endpoint
    },
    {
      name  = "PUSH_NOTIFICATIONS_QUEUE_NAME"
      value = data.azurerm_storage_queue.push_notifications.name
    },
    # Redis
    # Authentication is Microsoft Entra ID only (no access key): the CA's
    # system-assigned identity is granted data-plane access via `ca_iam`.
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
    # Session Cosmos DB (io-auth-SM) - accessed via managed identity
    {
      name  = "COSMOSDB_URI"
      value = var.session_cosmos.account_uri
    },
    {
      name  = "COSMOSDB_NAME"
      value = azurerm_cosmosdb_sql_database.session_manager.name
    },
    {
      name  = "COSMOSDB_SESSION_TOKEN_CONTAINER_NAME"
      value = azurerm_cosmosdb_sql_container.session_tokens.name
    },
    {
      name  = "COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME"
      value = azurerm_cosmosdb_sql_container.active_sessions.name
    },
    {
      name  = "COSMOSDB_LOLLIPOP_ACTIVATION_CONTAINER_NAME"
      value = azurerm_cosmosdb_sql_container.lollipop_activations.name
    },
    # One Identity configs
    {
      name  = "ONEID_PROD_CLIENT_ID"
      value = "4HWHRx-Wv19-cY-YL6Q1AgYVvx3h0Gw_SvtayZWJVVE"
    },
    {
      name  = "ONEID_PROD_CLIENT_SECRET"
      value = azurerm_key_vault_secret.sm_oneid_prod_client_secret.versionless_id
    },
    {
      name  = "ONEID_PROD_ISSUER"
      value = "https://io.oneid.pagopa.it"
    },
    {
      name  = "ONEID_PROD_REDIRECT_URI"
      value = "https://api-app.io.pagopa.it/api/auth/v2/callback"
    },
    {
      name  = "ONEID_UAT_CLIENT_ID"
      value = "XbFEUWXdvQGOU1usvMURZv4YWQjYFS0ggAk0xyFCEKc"
    },
    {
      name  = "ONEID_UAT_CLIENT_SECRET"
      value = azurerm_key_vault_secret.sm_oneid_uat_client_secret.versionless_id
    },
    {
      name  = "ONEID_UAT_ISSUER"
      value = "https://uat.io.oneid.pagopa.it"
    },
    {
      name  = "LOGIN_SUCCESS_REDIRECT_URL"
      value = "https://${trimsuffix(data.azurerm_dns_a_record.api_app_io_pagopa_it.fqdn, ".")}/profile.html"
    },
    {
      name  = "LOGIN_ERROR_REDIRECT_URL"
      value = "https://${trimsuffix(data.azurerm_dns_a_record.api_app_io_pagopa_it.fqdn, ".")}/error.html"
    },
    {
      name  = "AUTH_SESSIONS_TOPIC_NAME"
      value = var.service_bus.auth_session_topic_name
    },
    {
      name  = "SERVICE_BUS_HOSTNAME"
      value = var.service_bus.hostname
    },
    # TODO: Restrict the allowed IP source range for the following
    {
      name  = "ALLOW_BPD_IP_SOURCE_RANGE"
      value = "0.0.0.0/0"
    },
    {
      name  = "ALLOW_FIMS_IP_SOURCE_RANGE"
      value = "0.0.0.0/0"
    },
    {
      name  = "ALLOW_PAGOPA_IP_SOURCE_RANGE"
      value = "0.0.0.0/0"
    },
    {
      name  = "ALLOW_ZENDESK_IP_SOURCE_RANGE"
      value = "0.0.0.0/0"
    },
    {
      name  = "JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION"
      value = "1200"
    },
    {
      name  = "JWT_ZENDESK_SUPPORT_TOKEN_ISSUER"
      value = "app-backend.io.italia.it"
    },
    {
      name  = "JWT_ZENDESK_SUPPORT_TOKEN_SECRET"
      value = azurerm_key_vault_secret.sm_zendesk_support_token_secret.versionless_id
    },
    {
      name  = "TEST_LOGIN_FISCAL_CODES_COMPRESSED"
      value = azurerm_key_vault_secret.sm_test_login_fiscal_codes_compressed.versionless_id
    },
  ]
}
