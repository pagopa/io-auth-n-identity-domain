data "azurerm_key_vault" "auth" {
  name                = "${local.prefix}-${local.env_short}-${local.location_short}-${local.domain}-kv-01"
  resource_group_name = "${local.prefix}-${local.env_short}-${local.location_short}-${local.domain}-main-rg-01"
}

data "azurerm_key_vault" "ioweb" {
  name                = "${local.prefix}-${local.env_short}-${local.location_short}-ioweb-kv-01"
  resource_group_name = "${local.prefix}-${local.env_short}-${local.location_short}-ioweb-rg-01"
}

data "azurerm_key_vault_secret" "sonacloud_token" {
  key_vault_id = data.azurerm_key_vault.auth.id
  name         = "session-manager-repo-sonarcloud-token"
}

data "azurerm_key_vault_secret" "slack_webhook_url" {
  key_vault_id = data.azurerm_key_vault.auth.id
  name         = "slack-webhook-url-terraform-drift"
}
