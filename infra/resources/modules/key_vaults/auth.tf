resource "azurerm_key_vault" "auth" {
  name = provider::dx::resource_name(merge(var.environment, {
    resource_type   = "key_vault",
    name            = "auth"
    instance_number = 1,
  }))

  location                 = var.environment.location
  resource_group_name      = var.resource_group_name
  tenant_id                = var.tenant_id
  purge_protection_enabled = false

  tags = var.tags

  sku_name = "standard"

  enable_rbac_authorization = true
}

resource "azurerm_key_vault_key" "lollipop_assertion_01" {
  name         = "lollipop-assertions-storage-01"
  key_vault_id = azurerm_key_vault.auth.id
  key_type     = "RSA"
  key_size     = 4096

  key_opts = [
    "decrypt",
    "encrypt",
    "sign",
    "unwrapKey",
    "verify",
    "wrapKey"
  ]

  tags = var.tags
}

resource "azurerm_key_vault_key" "lv_logs_01" {
  name         = "lv-logs-storage-01"
  key_vault_id = azurerm_key_vault.auth.id
  key_type     = "RSA"
  key_size     = 4096

  key_opts = [
    "decrypt",
    "encrypt",
    "sign",
    "unwrapKey",
    "verify",
    "wrapKey"
  ]

  tags = var.tags
}
