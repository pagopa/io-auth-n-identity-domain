resource "azurerm_key_vault_secret" "auth_application_insights_connection_string" {
  name         = "ioweb-auth-application-insights-connection-string"
  key_vault_id = var.key_vault.id

  value_wo         = var.application_insights.connection_string
  value_wo_version = 1

  tags = var.tags
}
# OneIdentity client credentials (common `oneid.pagopa.it` environment).
# Values are set manually on the Key Vault once the IO-WEB client is federated.
resource "azurerm_key_vault_secret" "oneid_prod_client_id" {
  name         = "ioweb-auth-oneid-prod-client-id"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}

resource "azurerm_key_vault_secret" "oneid_prod_client_secret" {
  name         = "ioweb-auth-oneid-prod-client-secret"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}

resource "azurerm_key_vault_secret" "oneid_uat_client_id" {
  name         = "ioweb-auth-oneid-uat-client-id"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}

resource "azurerm_key_vault_secret" "oneid_uat_client_secret" {
  name         = "ioweb-auth-oneid-uat-client-secret"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}
