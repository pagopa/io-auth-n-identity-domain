resource "azurerm_key_vault_secret" "auth_application_insights_connection_string" {
  name         = "ioweb-auth-application-insights-connection-string"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}