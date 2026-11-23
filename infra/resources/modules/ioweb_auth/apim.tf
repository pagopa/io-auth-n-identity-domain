locals {
  external_api_ioweb_auth_openapi = yamldecode(data.http.external_api_ioweb_auth_openapi.response_body)
}

resource "azurerm_api_management_tag" "ioweb_auth_tag" {
  api_management_id = var.apim_id
  name              = "IOWEB-Auth-Service"
}

resource "azurerm_api_management_api_version_set" "ioweb_auth_version_set" {
  name                = "ioweb_auth"
  resource_group_name = var.apim_resource_group_name
  api_management_name = var.apim_name
  display_name        = "IO WEB auth version set"
  versioning_scheme   = "Segment"
}


##################
#  EXTERNAL API  #
##################
resource "azurerm_api_management_api" "external_api_ioweb_auth_service_v2" {
  name                  = "ioweb-auth-service-external-api-v2"
  api_management_name   = var.apim_name
  resource_group_name   = var.apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.ioweb_auth_version_set.id
  version        = "v2"
  revision       = 1

  description  = local.external_api_ioweb_auth_openapi.info.description
  display_name = local.external_api_ioweb_auth_openapi.info.title
  path         = var.external_api_base_path
  protocols    = ["https"]

  import {
    content_format = "openapi"
    content_value  = data.http.external_api_ioweb_auth_openapi.response_body
  }
}

resource "azurerm_api_management_api_policy" "external_api_ioweb_auth_service_v2" {
  api_name            = azurerm_api_management_api.external_api_ioweb_auth_service_v2.name
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name

  xml_content = local.apim_base_policy_pool
}

resource "azurerm_api_management_product_api" "external_api_ioweb_auth_service_v2" {
  api_name            = azurerm_api_management_api.external_api_ioweb_auth_service_v2.name
  resource_group_name = var.apim_resource_group_name
  api_management_name = var.apim_name
  product_id          = data.azurerm_api_management_product.ioweb_product.product_id
}

resource "azurerm_api_management_api_tag" "external_api_ioweb_auth_service_v2" {
  api_id = azurerm_api_management_api.external_api_ioweb_auth_service_v2.id
  name   = azurerm_api_management_tag.ioweb_auth_tag.name
}
