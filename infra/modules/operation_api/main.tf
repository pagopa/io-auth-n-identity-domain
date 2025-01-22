module "apim_v2_product_auth-n-identity_operation" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_product?ref=v8.27.0"

  product_id            = "io-auth-n-identity-operation-api"
  api_management_name   = var.apim_name
  resource_group_name   = var.apim_resource_group_name
  display_name          = "IO AUTH AND IDENTITY OPERATION API"
  description           = "Product for IO Auth And Identity Domani Operation APIs."
  subscription_required = false
  approval_required     = false
  published             = true

  policy_xml = file("./${path.module}/api/_base_policy.xml")
}



