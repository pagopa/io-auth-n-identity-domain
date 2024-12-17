module "common_values" {
  source = "github.com/pagopa/io-infra//src/_modules/common_values?ref=main"
}

data "azurerm_resource_group" "rg_common" {
  name = "${local.common_project}-rg-common"
}

data "azurerm_resource_group" "ioweb_storage_rg" {
  name = "${local.weu_project}-ioweb-storage-rg"
}

data "azurerm_virtual_network" "itn_common" {
  name                = "${local.project}-common-vnet-01"
  resource_group_name = "${local.project}-common-rg-01"
}

data "azurerm_subnet" "private_endpoints_subnet" {
  name                 = "${local.project}-pep-snet-01"
  virtual_network_name = data.azurerm_virtual_network.itn_common.name
  resource_group_name  = data.azurerm_virtual_network.itn_common.resource_group_name
}

data "azurerm_key_vault" "common" {
  name                = "${local.common_project}-kv-common"
  resource_group_name = "${local.common_project}-rg-common"
}

##########################
# Storage Accounts
##########################

data "azurerm_storage_account" "storage_api" {
  name                = replace("${local.common_project}stapi", "-", "")
  resource_group_name = "${local.common_project}-rg-internal"
}

data "azurerm_storage_account" "logs" {
  name                = replace("${local.common_project}-stlogs", "-", "")
  resource_group_name = "${local.common_project}-rg-operations"
}

data "azurerm_storage_account" "assets_cdn" {
  name                = replace("${local.common_project}-stcdnassets", "-", "")
  resource_group_name = "${local.common_project}-rg-common"
}

data "azurerm_storage_account" "notifications" {
  name                = replace("${local.common_project}-stnotifications", "-", "")
  resource_group_name = "${local.common_project}-rg-internal"
}

data "azurerm_storage_account" "iopstapp" {
  name                = replace(format("%s-st-app", local.common_project), "-", "")
  resource_group_name = "${local.common_project}-rg-internal"
}

data "azurerm_storage_account" "storage_apievents" {
  name                = replace(format("%s-st-api-events", local.common_project), "-", "")
  resource_group_name = "${local.common_project}-rg-internal"
}

data "azurerm_storage_account" "citizen_auth_common" {
  name                = replace(format("%s-weucitizenauthst", local.common_project), "-", "")
  resource_group_name = "${local.common_project}-citizen-auth-data-rg"
}

##########################
# APP GATEWAY DATA SOURCE
##########################
data "azurerm_application_gateway" "app_gateway" {
  name                = format("%s-appgateway", local.common_project)
  resource_group_name = local.appgw_resource_group_name
}

##########################
# SHARED APP SERVICE PLAN
##########################
data "azurerm_service_plan" "shared_plan_itn" {
  name                = format("%s-%s-shared-asp-01", local.project, "citizen-auth")
  resource_group_name = format("%s-%s-shared-rg-01", local.project, "citizen-auth")
}

data "azurerm_storage_account" "lollipop_assertion_storage" {
  name                = replace(format("%s-lollipop-assertions-st", local.common_project), "-", "")
  resource_group_name = format("%s-%s-data-rg", local.common_project, local.legacy_domain)
}
