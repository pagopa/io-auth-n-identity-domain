resource "azurerm_storage_container" "containers" {
  for_each = var.containers

  name               = each.value
  storage_account_id = var.storage_account.id
  metadata           = local.metadata

  default_encryption_scope          = lookup(var.encryption_scopes, each.value, null)
  encryption_scope_override_enabled = lookup(var.encryption_scopes, each.value, null) != null ? false : null
}

resource "azurerm_storage_container_immutability_policy" "immutability_policies" {
  for_each = var.immutability_policies

  storage_container_resource_manager_id = azurerm_storage_container.containers[each.key].resource_manager_id
  immutability_period_in_days           = tonumber(each.value)
}
