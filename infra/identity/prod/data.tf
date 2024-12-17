data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "weu_common" {
  name = "${local.project_common}-rg-common"
}

data "azurerm_key_vault" "weu_common" {
  name                = "${local.project_common}-kv-common"
  resource_group_name = data.azurerm_resource_group.weu_common.name
}
