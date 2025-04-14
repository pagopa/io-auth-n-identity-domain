resource "azurerm_api_management_group" "api_profile_external_read" {
  name                = "apiprofileexternalread"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "ApiProfileExternalRead"
  description         = "A group that enables other PagoPa teams to operate over Profiles (Readonly)"
}

resource "azurerm_api_management_named_value" "api_profile_external_read_group_name" {
  name                = "api-profile-external-read-group-name"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "api-profile-external-read-group-name"
  value               = azurerm_api_management_group.api_profile_external_read.display_name
  secret              = "true"
}

module "api_v2_profile_external" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-profile-external-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  revision            = "1"
  display_name        = "IO PROFILE EXTERNAL API"
  description         = "Product for IO Profile External."

  path        = "${local.external_api_basepath}/profile/api/v1"
  protocols   = ["https"]
  product_ids = [module.apim_v2_product_auth-n-identity_external.product_id]

  service_url = "${var.function_profile_url}/api/v1"

  subscription_required = true

  content_format = "openapi"
  content_value = templatefile("./${path.module}/api/io_profile_api/v1/_swagger.yaml.tpl",
    {
      host     = var.api_host_name
      basePath = "${local.external_api_basepath}/profile/api/v1"
    }
  )

  xml_content = file("./${path.module}/api/io_profile_api/v1/policy.xml")
}

resource "azurerm_api_management_api_operation_policy" "get_profile_external" {
  api_name            = "io-profile-external-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  operation_id        = "getProfile"

  xml_content = file("./${path.module}/api/io_profile_api/v1/get_profile_policy/policy.xml")
  depends_on  = [module.api_v2_profile_external]
}
