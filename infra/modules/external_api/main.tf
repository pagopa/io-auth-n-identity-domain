module "apim_v2_product_auth-n-identity_external" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_product?ref=v8.27.0"

  product_id            = "io-auth-n-identity-external-api"
  api_management_name   = var.apim_name
  resource_group_name   = var.apim_resource_group_name
  display_name          = "IO AUTH AND IDENTITY EXTERNAL API"
  description           = "Product for IO Auth And Identity APIs."
  subscription_required = true
  approval_required     = false
  published             = true

  policy_xml = file("./${path.module}/api/_base_policy.xml")
}

resource "azurerm_api_management_user" "auth_n_identity_wallet_external_user" {
  user_id             = "authnidentitywalletexternaluser"
  api_management_name = data.azurerm_api_management.apim.name
  resource_group_name = data.azurerm_api_management.apim.resource_group_name
  first_name          = "PagoPA Wallet"
  last_name           = "PagoPA Wallet"
  email               = "io-wallet@pagopa.it" // TODO: check email correctness
  state               = "active"
}

resource "azurerm_api_management_group_user" "auth_n_identity_external_group" {
  user_id             = azurerm_api_management_user.auth_n_identity_wallet_external_user.user_id
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  group_name          = azurerm_api_management_group.api_profile_external_read.name
}

resource "azurerm_api_management_subscription" "auth_n_identity_external" {
  user_id             = azurerm_api_management_user.auth_n_identity_wallet_external_user.id
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  product_id          = module.apim_v2_product_auth-n-identity_external.id
  display_name        = "Auth & Identity External API"
  state               = "active"
  allow_tracing       = false
}
