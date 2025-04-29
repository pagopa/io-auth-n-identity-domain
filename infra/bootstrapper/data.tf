data "azurerm_key_vault" "citizen_auth_kv" {
  name                = "${local.prefix}-${local.env_short}-citizen-auth-kv"
  resource_group_name = "${local.prefix}-${local.env_short}-citizen-auth-sec-rg"
}

data "azurerm_key_vault_secret" "sonacloud_token" {
  key_vault_id = data.azurerm_key_vault.citizen_auth_kv.id
  name         = "session-manager-repo-sonarcloud-token"
}
