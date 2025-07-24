output "auth" {
  value = {
    id                  = azurerm_key_vault.auth.id
    name                = azurerm_key_vault.auth.name
    resource_group_name = azurerm_key_vault.auth.resource_group_name
  }
}

output "lollipop_assertion_01" {
  value = {
    id   = azurerm_key_vault_key.lollipop_assertion_01.id
    name = azurerm_key_vault_key.lollipop_assertion_01.name
  }
}

output "lv_logs_01" {
  value = {
    id   = azurerm_key_vault_key.lv_logs_01.id
    name = azurerm_key_vault_key.lv_logs_01.name
  }
}

