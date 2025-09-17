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

resource "azurerm_key_vault_secret" "redis_access_key" {
  name         = "redis-access-key"
  key_vault_id = module.key_vaults.auth.id
  value        = data.azurerm_redis_cache.core_domain_redis_common.primary_access_key

  tags = local.tags
}

resource "azurerm_key_vault_secret" "lv_audit_logs_st_connection_string" {
  name         = "lv-audit-logs-st-connection-string"
  key_vault_id = module.key_vaults.auth.id
  value        = data.azurerm_storage_account.immutable_lv_audit_logs_storage.primary_connection_string

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

