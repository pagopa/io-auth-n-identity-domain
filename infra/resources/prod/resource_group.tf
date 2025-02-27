resource "azurerm_resource_group" "main_resource_group" {
  name     = "${local.project}-${local.domain}-main-rg-01"
  location = local.location

  tags = local.tags
}