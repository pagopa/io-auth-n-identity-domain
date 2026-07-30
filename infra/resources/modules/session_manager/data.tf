

data "azurerm_storage_account" "io_com" {
  name                = "iopitncomst01"
  resource_group_name = "io-p-itn-com-rg-01"
}

data "azurerm_storage_queue" "push_notifications" {
  name               = "push-notifications"
  storage_account_id = data.azurerm_storage_account.io_com.id
}
