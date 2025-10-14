resource "azurerm_api_management_group" "api_profile_internal_read" {
  name                = "apiprofileinternalread"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "ApiProfileInternalRead"
  description         = "A group that enables other PagoPa teams to operate over Profiles (Readonly)"
}

resource "azurerm_api_management_named_value" "api_profile_internal_read_group_name" {
  name                = "api-profile-internal-read-group-name"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "api-profile-internal-read-group-name"
  value               = azurerm_api_management_group.api_profile_internal_read.display_name
  secret              = "true"
}

module "api_v2_profile_internal" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.40.3"

  name                = "io-profile-internal-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  revision            = "1"
  display_name        = "IO PROFILE INTERNAL API"
  description         = "Internal Auth&Identity Profile API."

  path        = "${local.internal_api_basepath}/profile/api/v1"
  protocols   = ["https"]
  product_ids = [module.apim_v2_product_auth-n-identity_internal.product_id]

  service_url = "${var.function_profile_url}/api/v1"

  subscription_required = true

  content_format = "openapi"
  content_value = templatefile("./${path.module}/api/io_profile_api/v1/_swagger.yaml.tpl",
    {
      host     = var.api_host_name
      basePath = "${local.internal_api_basepath}/profile/api/v1"
    }
  )

  xml_content = file("./${path.module}/api/io_profile_api/v1/policy.xml")
}

resource "azurerm_api_management_api_operation_policy" "get_profile_internal" {
  api_name            = "io-profile-internal-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  operation_id        = "getProfile"

  xml_content = file("./${path.module}/api/io_profile_api/v1/get_profile_policy/policy.xml")
  depends_on  = [module.api_v2_profile_internal]
}
