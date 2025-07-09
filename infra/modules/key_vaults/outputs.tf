output "auth" {
  value = {
    id                  = azurerm_key_vault.auth.id
    name                = azurerm_key_vault.auth.name
    resource_group_name = azurerm_key_vault.auth.resource_group_name
  }
}

output "ioweb" {
  value = {
    id                  = azurerm_key_vault.ioweb.id
    name                = azurerm_key_vault.ioweb.name
    resource_group_name = azurerm_key_vault.ioweb.resource_group_name
  }
}
