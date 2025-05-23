data "azurerm_resource_group" "main_resource_group" {
  name = "${local.project}-${local.domain}-main-rg-01"
}
