output "resource_group_identity" {
  value = {
    id       = azurerm_resource_group.rg_identity.id
    name     = azurerm_resource_group.rg_identity.name
    location = azurerm_resource_group.rg_identity.location
  }
}