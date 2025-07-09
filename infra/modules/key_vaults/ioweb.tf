resource "azurerm_key_vault" "ioweb" {
  name = provider::dx::resource_name(merge(var.environment, {
    resource_type   = "key_vault",
    name            = "ioweb"
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
