resource "azurerm_storage_container" "containers" {
  for_each = var.containers

  name               = each.value
  storage_account_id = var.storage_account.id
  metadata           = local.metadata

  default_encryption_scope          = lookup(var.encryption_scopes, each.value, null)
  encryption_scope_override_enabled = lookup(var.encryption_scopes, each.value, null) != null ? false : null
}
