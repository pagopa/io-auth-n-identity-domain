module "apim_itn_bff_api" {
  source = "git::https://github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.61.0"

  name                  = format("%s-ioweb-bff", local.product)
  api_management_name   = data.azurerm_api_management.apim.name
  resource_group_name   = data.azurerm_api_management.apim.resource_group_name
  product_ids           = ["io-web-api"]
  subscription_required = false

  service_url = format(local.bff_backend_url, var.function_web_profile_hostname)

  description  = "Bff API for IO Web platform"
  display_name = "IO Web - Bff"
  path         = var.function_web_profile_basepath
  protocols    = ["https"]

  content_format = "openapi-link"

  content_value = "https://raw.githubusercontent.com/pagopa/io-web-profile-backend/a2a6be1434e75089fb46e1aba50678cbbe32afd1/openapi/external.yaml"

  xml_content = file("./${path.module}/api/bff/policy.xml")
}

resource "azurerm_api_management_api_operation_policy" "unlock_user_session_policy_itn" {
  api_name            = format("%s-ioweb-bff", local.product)
  api_management_name = data.azurerm_api_management.apim.name
  resource_group_name = data.azurerm_api_management.apim.resource_group_name
  operation_id        = "unlockUserSession"

  xml_content = file("./${path.module}/api/bff/post_unlockusersession_policy/policy.xml")
}

resource "azurerm_api_management_named_value" "io_fn3_services_key_itn" {
  name                = "ioweb-profile-api-key"
  api_management_name = data.azurerm_api_management.apim.name
  resource_group_name = data.azurerm_api_management.apim.resource_group_name
  display_name        = "ioweb-profile-api-key"
  value               = data.azurerm_key_vault_secret.io_fn3_services_key_secret.value
  secret              = "true"
}