resource "azurerm_storage_queue" "queues" {
  for_each = var.queues

  name               = each.value
  storage_account_id = var.storage_account.id
  metadata           = local.metadata
}
