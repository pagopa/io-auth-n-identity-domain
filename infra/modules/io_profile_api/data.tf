# APIM
data "azurerm_api_management" "apim" {
  name                = var.apim_name
  resource_group_name = var.apim_resource_group_name
}

# Secrets

# TODO: Add Secret into kv ad use it here
# TODO: this is provisional
data "azurerm_key_vault_secret" "io_fn_profile_key_secret_v2" {
  name         = "fn3public-KEY-APIM" # TODO: "fn-profile-KEY-APIM"
  key_vault_id = var.key_vault_common_id
}
