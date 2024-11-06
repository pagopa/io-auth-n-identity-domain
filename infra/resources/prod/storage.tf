data "azurerm_storage_account" "immutable_lv_audit_logs_storage" {
  name                = replace("${local.common_project}-lv-logs-im-st", "-", "")
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
}
