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

resource "azurerm_key_vault_secret" "sm_oneid_prod_client_secret" {
  name         = "sm-oneid-prod-client-secret"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}

resource "azurerm_key_vault_secret" "sm_oneid_uat_client_secret" {
  name         = "sm-oneid-uat-client-secret"
  key_vault_id = var.key_vault.id

  value_wo         = ""
  value_wo_version = 1

  tags = var.tags
}
