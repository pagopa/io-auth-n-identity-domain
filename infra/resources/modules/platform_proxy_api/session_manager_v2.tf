resource "azurerm_api_management_api" "external_api_session_manager_v2" {
  name                  = "io-session-manager-external-api-v2"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.auth_v1.id
  version        = "v2"
  revision       = 1

  description  = "Auth & Identity Session Manager External API with OI integration"
  display_name = "IO SESSION MANAGER OI EXTERNAL API"
  path         = var.external_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.external_api_base_path}/v2"

  import {
    content_format = "openapi-link"
    content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/1330014a83b1bca9a5b26d541f0e25922054aaab/apps/io-session-manager-oi/api/external.yaml"

  }
}

resource "azurerm_api_management_product_api" "external_api_session_manager_v2" {
  api_name            = azurerm_api_management_api.external_api_session_manager_v2.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  product_id          = data.azurerm_api_management_product.apim_platform_domain_product.product_id
}

resource "azurerm_api_management_api_tag" "external_api_session_manager_v2" {
  api_id = azurerm_api_management_api.external_api_session_manager_v2.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

