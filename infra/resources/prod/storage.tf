data "azurerm_storage_account" "immutable_lv_audit_logs_storage" {
  name                = replace("${local.common_project}-lv-logs-im-st", "-", "")
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
}

data "azurerm_storage_account" "immutable_spid_logs_storage" {
  name                = replace(format("%s-ioweb-spid-logs-im-st", local.weu_project), "-", "")
  resource_group_name = data.azurerm_resource_group.ioweb_storage_rg.name
}

data "azurerm_storage_account" "citizen_auth_common" {
  name                = replace(format("%s-%s-st", local.weu_project, local.legacy_domain), "-", "")
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
}

data "azurerm_storage_account" "storage_api" {
  name                = replace(format("%s-st-api", local.common_project), "-", "")
  resource_group_name = format("%s-rg-internal", local.common_project)
}

data "azurerm_storage_account" "storage_app" {
  name                = replace(format("%s-st-app", local.common_project), "-", "")
  resource_group_name = format("%s-rg-internal", local.common_project)
}

data "azurerm_storage_account" "storage_apievents" {
  name                = replace(format("%s-st-api-events", local.common_project), "-", "")
  resource_group_name = format("%s-rg-internal", local.common_project)
}

data "azurerm_storage_account" "storage_logs" {
  name                = replace(format("%s-st-logs", local.common_project), "-", "")
  resource_group_name = format("%s-rg-operations", local.common_project)
}

data "azurerm_storage_account" "push_notifications_storage" {
  name                = replace(format("%s-weu-messages-notifst", local.common_project), "-", "")
  resource_group_name = format("%s-weu-messages-notifications-rg", local.common_project)
}

data "azurerm_storage_account" "locked_profiles_storage" {
  name                = replace(format("%s-locked-profiles-st", local.common_project), "-", "")
  resource_group_name = format("%s-rg-internal", local.common_project)
}
