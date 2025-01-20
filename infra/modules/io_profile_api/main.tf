resource "azurerm_api_management_group" "api_profile_operation_read_v2" {
  name                = "apiprofileoperationread"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "ApiProfileOperationRead"
  description         = "A group that enables PagoPa Operation to operate over Profiles"
}

module "apim_v2_product_profile_operation" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_product?ref=v8.27.0"

  product_id            = "io-profile-operation-api"
  api_management_name   = var.apim_name
  resource_group_name   = var.apim_resource_group_name
  display_name          = "IO PROFILE OPERATION API"
  description           = "Product for IO Profile Operation."
  subscription_required = false
  approval_required     = false
  published             = true

  policy_xml = file("./${path.module}/api/_base_policy.xml")
}

resource "azurerm_api_management_named_value" "io_fn_profile_url_v2" {
  name                = "io-fn-profile-url"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "io-fn-profile-url"
  value               = "https://io-p-itn-auth-profile-fn-01.azurewebsites.net"
}

resource "azurerm_api_management_named_value" "io_fn_profile_key_v2" {
  name                = "io-fn-profile-key"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "io-fn-profile-key"
  value               = data.azurerm_key_vault_secret.io_fn_profile_key_secret_v2.value
  secret              = "true"
}

resource "azurerm_api_management_named_value" "api_profile_operation_group_name_v2" {
  name                = "api-profile-operation-group-name"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "api-profile-operation-group-name"
  value               = azurerm_api_management_group.api_profile_operation_read_v2.name
  secret              = "true"
}

module "api_v2_profile_operation" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-profile-operation-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  revision            = "1"
  display_name        = "IO PROFILE OPERATION API"
  description         = "Product for IO Profile Operation."

  path        = "profile/api/v1"
  protocols   = ["https"]
  product_ids = [module.apim_v2_product_profile_operation.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi"
  content_value = templatefile("./${path.module}/api/v1/_swagger.yaml.tpl",
    {
      host     = var.api_host_name
      basePath = "profile/api/v1"
    }
  )

  xml_content = file("./${path.module}/api/v1/policy.xml")
}


resource "azurerm_api_management_api_operation_policy" "get_profile_operation_v2" {
  api_name            = "io-profile-operation-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  operation_id        = "getProfile"

  xml_content = file("./${path.module}/api/v1/get_profile_policy/policy.xml")
}
