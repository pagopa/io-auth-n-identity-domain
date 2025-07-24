data "azurerm_resource_group" "main_resource_group" {
  name = "${local.project}-${local.domain}-main-rg-01"
}

data "azurerm_resource_group" "audit" {
  name = "${local.project}-${local.domain}-audit-rg-01"
}
