resource "azurerm_resource_group" "rg_identity" {
  name     = "${local.project}-identity-rg"
  location = var.location

  tags = var.tags
}