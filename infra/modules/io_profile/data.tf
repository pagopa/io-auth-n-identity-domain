# APIM
data "azurerm_api_management" "apim" {
  name                = var.apim_name
  resource_group_name = var.apim_resource_group_name
}

# Secrets

data "azurerm_key_vault_secret" "io_fn3_public_key_secret_v2" {
  name         = "fn3public-KEY-APIM"
  key_vault_id = var.key_vault_common_id
}
