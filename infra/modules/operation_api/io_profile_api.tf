resource "azurerm_api_management_group" "api_profile_operation_read" {
  name                = "apiprofileoperationread"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "ApiProfileOperationRead"
  description         = "A group that enables PagoPa Operation to operate over Profiles (Readonly)"
}

resource "azurerm_api_management_group" "api_profile_operation_write" {
  name                = "apiprofileoperationwrite"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "ApiProfileOperationWrite"
  description         = "A group that enables PagoPa Operation to operate over Profiles (Write)"
}

resource "azurerm_api_management_named_value" "io_fn_profile_key" {
  name                = "io-fn-profile-key"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "io-fn-profile-key"
  value               = data.azurerm_key_vault_secret.io_fn_profile_key_secret.value
  secret              = "true"
}

resource "azurerm_api_management_named_value" "io_fn_admin_master_key" {
  name                = "io-fn-admin-master-key"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "io-fn-admin-master-key"
  value               = data.azurerm_key_vault_secret.io_fn_admin_master_key_secret.value
  secret              = "true"
}

resource "azurerm_api_management_named_value" "api_profile_operation_read_group_name" {
  name                = "api-profile-operation-read-group-name"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "api-profile-operation-read-group-name"
  value               = azurerm_api_management_group.api_profile_operation_read.display_name
  secret              = "true"
}

resource "azurerm_api_management_named_value" "api_profile_operation_write_group_name" {
  name                = "api-profile-operation-write-group-name"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "api-profile-operation-write-group-name"
  value               = azurerm_api_management_group.api_profile_operation_write.display_name
  secret              = "true"
}

resource "azurerm_api_management_named_value" "io_fn_admin_trigger_url" {
  name                = "io-fn-admin-trigger-url"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "io-fn-admin-trigger-url"
  value               = "${var.function_admin_url}/admin/functions"
  secret              = "true"
}

module "api_v2_profile_operation" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-profile-operation-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  revision            = "1"
  display_name        = "IO PROFILE OPERATION API"
  description         = "Operation Auth&Identity Profile API."

  path        = "${local.operation_api_basepath}/profile/api/v1"
  protocols   = ["https"]
  product_ids = [module.apim_v2_product_auth-n-identity_operation.product_id]

  service_url = "${var.function_profile_url}/api/v1"

  subscription_required = true

  content_format = "openapi"
  content_value = templatefile("./${path.module}/api/io_profile_api/v1/_swagger.yaml.tpl",
    {
      host     = var.api_host_name
      basePath = "${local.operation_api_basepath}/profile/api/v1"
    }
  )

  xml_content = file("./${path.module}/api/io_profile_api/v1/policy.xml")
}

resource "azurerm_api_management_api_operation_policy" "get_profile_operation" {
  api_name            = "io-profile-operation-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  operation_id        = "getProfile"

  xml_content = file("./${path.module}/api/io_profile_api/v1/get_profile_policy/policy.xml")
  depends_on  = [module.api_v2_profile_operation]
}


resource "azurerm_api_management_api_operation_policy" "sanitize_profile_email_operation" {
  api_name            = "io-profile-operation-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  operation_id        = "sanitizeProfileEmail"

  xml_content = file("./${path.module}/api/io_profile_api/v1/sanitize_profile_email_policy/policy.xml")
  depends_on  = [module.api_v2_profile_operation]
}
