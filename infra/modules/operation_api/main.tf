module "apim_v2_product_auth-n-identity_operation" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_product?ref=v8.27.0"

  product_id            = "io-auth-n-identity-operation-api"
  api_management_name   = var.apim_name
  resource_group_name   = var.apim_resource_group_name
  display_name          = "IO AUTH AND IDENTITY OPERATION API"
  description           = "Product for IO Auth And Identity Domani Operation APIs."
  subscription_required = true
  approval_required     = false
  published             = true

  policy_xml = file("./${path.module}/api/_base_policy.xml")
}

resource "azurerm_api_management_group_user" "auth_n_identity_operation_group" {
  user_id             = data.azurerm_api_management_user.auth_n_identity_operation_user.user_id
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  group_name          = azurerm_api_management_group.api_profile_operation_read.name
}


resource "azurerm_api_management_group_user" "auth_n_identity_profile_operation_write_group" {
  user_id             = data.azurerm_api_management_user.auth_n_identity_operation_user.user_id
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  group_name          = azurerm_api_management_group.api_profile_operation_write.name
}

resource "azurerm_api_management_subscription" "auth_n_identity_operation" {
  user_id             = data.azurerm_api_management_user.auth_n_identity_operation_user.id
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  product_id          = module.apim_v2_product_auth-n-identity_operation.id
  display_name        = "Auth & Identity Operation API"
  state               = "active"
  allow_tracing       = false
  primary_key         = var.operation_subscription_primary_key
  secondary_key       = var.operation_subscription_secondary_key
}
