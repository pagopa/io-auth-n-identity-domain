data "azurerm_storage_account" "immutable_lv_audit_logs_storage" {
  name                = replace("${local.common_project}-lv-logs-im-st", "-", "")
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
}

data "azurerm_storage_account" "immutable_spid_logs_storage" {
  name                = replace(format("%s-ioweb-spid-logs-im-st", local.weu_project), "-", "")
  resource_group_name = data.azurerm_resource_group.ioweb_storage_rg.name
}
