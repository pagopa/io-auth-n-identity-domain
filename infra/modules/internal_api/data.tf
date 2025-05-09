# APIM
data "azurerm_api_management" "apim" {
  name                = var.apim_name
  resource_group_name = var.apim_resource_group_name
}

# Secrets

data "azurerm_key_vault_secret" "io_fn_profile_key_secret" {
  name         = "fn-profile-KEY-APIM"
  key_vault_id = var.key_vault_common_id
}
