resource "azurerm_storage_table" "tables" {
  for_each = var.tables

  name                 = each.value
  storage_account_name = var.storage_account.name
}
