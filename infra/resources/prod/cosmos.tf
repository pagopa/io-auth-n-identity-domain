data "azurerm_resource_group" "core_domain_data_rg" {
  name = "${local.common_project}-citizen-auth-data-rg"
}

data "azurerm_cosmosdb_account" "cosmos_citizen_auth" {
  name                = "${local.common_project}-citizen-auth-account"
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
}
