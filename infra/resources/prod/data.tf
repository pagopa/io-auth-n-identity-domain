data "azurerm_client_config" "current" {}

data "azurerm_subscription" "current" {}

module "common_values" {
  source = "github.com/pagopa/io-infra//src/_modules/common_values?ref=main"
}

data "azurerm_resource_group" "rg_common" {
  name = "${local.common_project}-rg-common"
}

data "azurerm_resource_group" "itn_auth_01" {
  name = "${local.project}-auth-rg-01"
}

data "azurerm_resource_group" "ioweb_storage_rg" {
  name = "${local.weu_project}-ioweb-storage-rg"
}

data "azurerm_virtual_network" "itn_common" {
  name                = "${local.project}-common-vnet-01"
  resource_group_name = "${local.project}-common-rg-01"
}

data "azurerm_virtual_network" "weu_common" {
  name                = "io-p-vnet-common"
  resource_group_name = data.azurerm_resource_group.rg_common.name
}

data "azurerm_subnet" "private_endpoints_subnet" {
  name                 = "${local.project}-pep-snet-01"
  virtual_network_name = data.azurerm_virtual_network.itn_common.name
  resource_group_name  = data.azurerm_virtual_network.itn_common.resource_group_name
}

data "azurerm_subnet" "weu_private_endpoints_subnet" {
  name                 = "pendpoints"
  virtual_network_name = data.azurerm_virtual_network.weu_common.name
  resource_group_name  = data.azurerm_virtual_network.weu_common.resource_group_name
}

data "azurerm_linux_web_app" "weu_session_manager" {
  name                = "${local.weu_project}-session-manager-app-03"
  resource_group_name = "${local.weu_project}-session-manager-rg-01"
}

##########################
# Entra ID
##########################

data "azuread_group" "auth_admins" {
  display_name = "${local.common_project}-adgroup-auth-admins"
}

data "azuread_group" "auth_devs" {
  display_name = "${local.common_project}-adgroup-auth-developers"
}

##########################
# APP GATEWAY DATA SOURCE
##########################
data "azurerm_application_gateway" "app_gateway" {
  name                = format("%s-agw-01", local.project)
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

##########################
#       PLATFORM
##########################
data "azurerm_servicebus_namespace" "platform_service_bus_namespace" {
  name                = format("%s-platform-sbns-01", local.project)
  resource_group_name = format("%s-common-rg-01", local.project)
}

data "azurerm_api_management" "platform_apim" {
  resource_group_name = local.platform_apim_resource_group_name
  name                = local.platform_apim_name
}
