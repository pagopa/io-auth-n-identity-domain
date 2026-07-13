resource "azurerm_key_vault_secret" "sm_lollipop_api_key" {
  name         = "sm-lollipop-api-key"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}

resource "azurerm_key_vault_secret" "sm_io_profile_api_key" {
  name         = "sm-io-profile-api-key"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}
