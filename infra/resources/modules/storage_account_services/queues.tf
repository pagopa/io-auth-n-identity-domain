resource "azurerm_storage_queue" "queues" {
  for_each = var.queues

  name                 = each.value
  storage_account_name = var.storage_account.name
  metadata             = local.metadata
}
