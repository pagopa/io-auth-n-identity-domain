resource "azurerm_api_management_api_version_set" "identity_v1" {
  name                = "identity_v1"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "Auth-n-Identity AppBackend v1"
  versioning_scheme   = "Segment"
}

resource "azurerm_api_management_named_value" "app_backend_key" {
  name                = "io-auth-app-backend-key"
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name
  display_name        = "io-auth-app-backend-key"
  value               = data.azurerm_key_vault_secret.app_backend_api_key_secret.value
  secret              = true
}

resource "azurerm_api_management_api" "identity" {
  name                  = "io-p-identity-api"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.identity_v1.id
  version        = "v1"
  revision       = 1

  description  = "IO Auth-n-Identity AppBackend API"
  display_name = "Auth-n-Identity AppBackend"
  path         = "api/identity"
  protocols    = ["https"]

  import {
    content_format = "openapi-link"
    content_value  = "https://raw.githubusercontent.com/pagopa/io-backend/51857746745d5400b2edb1385f8f2b2654c01ed4/openapi/generated/api_identity.yaml"
  }
}

resource "azurerm_api_management_product_api" "auth_identity" {
  api_name            = azurerm_api_management_api.identity.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  product_id          = data.azurerm_api_management_product.apim_platform_domain_product.product_id
}

resource "azurerm_api_management_api_policy" "identity" {
  api_name            = azurerm_api_management_api.identity.name
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name

  xml_content = file("${path.module}/policies/backend/_api_base_policy.xml")
}

resource "azurerm_api_management_api_tag" "app_backend_api_tag" {
  api_id = azurerm_api_management_api.identity.id
  name   = azurerm_api_management_tag.app_backend_tag.name
}

