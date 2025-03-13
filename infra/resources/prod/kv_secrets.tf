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

resource "azurerm_key_vault_secret" "cosmos_api_connection_string" {
  name         = "cosmos-api-connection-string"
  key_vault_id = data.azurerm_key_vault.kv.id
  value        = format("AccountEndpoint=%s;AccountKey=%s;", data.azurerm_cosmosdb_account.cosmos_api.endpoint, data.azurerm_cosmosdb_account.cosmos_api.primary_key)

  tags = local.tags
}

resource "azurerm_key_vault_secret" "citizen_auth_common_connection_string" {
  name         = "citizen-auth-common-connection-string"
  key_vault_id = data.azurerm_key_vault.kv.id
  value        = data.azurerm_storage_account.citizen_auth_common.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "iopstapp_connection_string" {
  name         = "iopstapp-connection-string"
  key_vault_id = data.azurerm_key_vault.kv.id
  value        = data.azurerm_storage_account.storage_app.primary_connection_string

  tags = local.tags
}

resource "azurerm_key_vault_secret" "iopstlogs_connection_string" {
  name         = "iopstlogs-connection-string"
  key_vault_id = data.azurerm_key_vault.kv.id
  value        = data.azurerm_storage_account.storage_logs.primary_connection_string

  tags = local.tags
}
