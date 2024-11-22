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
data "azurerm_app_service_plan" "shared_plan_itn" {
  name                = format("%s-%s-shared-asp-01", local.project, "citizen-auth")
  resource_group_name = format("%s-%s-shared-rg-01", local.project, "citizen-auth")
}
