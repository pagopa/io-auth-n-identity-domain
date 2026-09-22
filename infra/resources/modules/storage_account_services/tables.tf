resource "azurerm_storage_table" "tables" {
  for_each = var.tables

  name               = each.value
  storage_account_id = var.storage_account.id
}
