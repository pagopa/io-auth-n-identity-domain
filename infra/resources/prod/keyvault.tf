data "azurerm_key_vault" "kv" {
  name                = "${local.common_project}-citizen-auth-kv"
  resource_group_name = "${local.common_project}-citizen-auth-sec-rg"
}

data "azurerm_key_vault" "ioweb_kv" {
  name                = "${local.common_project}-ioweb-kv"
  resource_group_name = "${local.common_project}-ioweb-sec-rg"
}

data "azurerm_key_vault" "common_kv" {
  name                = "${local.common_project}-kv-common"
  resource_group_name = "${local.common_project}-rg-common"
}
