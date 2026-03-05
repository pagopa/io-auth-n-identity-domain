resource "azurerm_key_vault_access_policy" "func_profas" {
  key_vault_id = data.azurerm_key_vault.kv.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.function_profile_async.function_app.function_app.principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

resource "azurerm_key_vault_access_policy" "func_profas_staging" {
  key_vault_id = data.azurerm_key_vault.kv.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.function_profile_async.function_app.function_app.slot.principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

resource "azurerm_key_vault_access_policy" "kv_common_func_profas" {
  key_vault_id = data.azurerm_key_vault.common_kv.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.function_profile_async.function_app.function_app.principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

resource "azurerm_key_vault_access_policy" "kv_common_func_profas_staging" {
  key_vault_id = data.azurerm_key_vault.common_kv.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.function_profile_async.function_app.function_app.slot.principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

# Connection strings

data "azurerm_key_vault_secret" "cosmos_api_connection_string" {
  name         = "cosmos-api-connection-string"
  key_vault_id = data.azurerm_key_vault.common_kv.id
}

resource "azurerm_key_vault_secret" "cosmos_auth_connection_string" {
  name         = "cosmos-auth-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = format("AccountEndpoint=%s;AccountKey=%s;", data.azurerm_cosmosdb_account.cosmos_citizen_auth.endpoint, data.azurerm_cosmosdb_account.cosmos_citizen_auth.primary_key)

  tags = local.tags
}

resource "azurerm_key_vault_secret" "cosmos_primary_key" {
  name         = "cosmos-auth-primary-key"
  value        = data.azurerm_cosmosdb_account.cosmos_citizen_auth.primary_key
  key_vault_id = module.key_vaults.auth.id

  tags = local.tags
}

resource "azurerm_key_vault_secret" "lollipop_assertions_st_connection_string" {
  name         = "lollipop-assertions-st-connection-string"
  value        = data.azurerm_storage_account.lollipop_assertion_storage.primary_connection_string
  key_vault_id = module.key_vaults.auth.id

  tags = local.tags
}

resource "azurerm_key_vault_secret" "citizen_auth_common_connection_string" {
  name         = "citizen-auth-common-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = data.azurerm_storage_account.citizen_auth_common.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "iopstapp_connection_string" {
  name         = "iopstapp-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = data.azurerm_storage_account.storage_app.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "iopstlogs_connection_string" {
  name         = "iopstlogs-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = data.azurerm_storage_account.storage_logs.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "session_st_connection_string" {
  name         = "session-st-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = module.storage_accounts.session.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "maintenance_st_connection_string" {
  name         = "maintenance-st-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = module.storage_accounts.maintenance.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "audit_st_connection_string" {
  name         = "audit-st-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = module.storage_accounts.audit.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "ioweb_kv_audit_st_connection_string" {
  name         = "ioweb-kv-audit-st-connection-string"
  key_vault_id = data.azurerm_key_vault.ioweb.id
  value        = module.storage_accounts.audit.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "common_kv_session_st_connection_string" {
  name         = "common-kv-session-st-connection-string"
  key_vault_id = data.azurerm_key_vault.common_kv.id
  value        = module.storage_accounts.session.primary_connection_string

  tags = local.tags
}

# Secrets

# TODO: Remove
resource "azurerm_key_vault_secret" "redis_access_key_itn" {
  name         = "redis-access-key-itn"
  key_vault_id = module.key_vaults.auth.id
  value        = module.redis_common_itn.primary_access_key

  tags = local.tags
}

resource "azurerm_key_vault_secret" "common_redis_access_key" {
  name         = "redis-access-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "common_weu_redis_access_key" {
  name         = "redis-weu-access-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "fast_login_session_manager_internal_api_key" {
  name         = "fast-login-session-manager-internal-api-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "fast_login_lollipop_api_key" {
  name         = "fast-login-lollipop-api-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "lollipop_first_consumer_api_key" {
  name         = "lollipop-first-consumer-api-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "mailup_transactional_username" {
  name         = "mailup-transactional-username"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "mailup_transactional_secret" {
  name         = "mailup-transactional-secret"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "mailup_common_username" {
  name         = "mailup-common-username"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "mailup_common_secret" {
  name         = "mailup-common-secret"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "io_api_key" {
  name         = "io-api-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "profile_magic_link_api_key" {
  name         = "profile-magic-link-api-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "profas_session_manager_internal_api_key" {
  name         = "profas-session-manager-internal-api-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "profas_profile_api_key" {
  name         = "profas-profile-api-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}

resource "azurerm_key_vault_secret" "profas_spidlogs_public_key" {
  name         = "profas-spidlogs-public-key"
  key_vault_id = module.key_vaults.auth.id

  value_wo         = ""
  value_wo_version = 1

  tags = local.tags
}
