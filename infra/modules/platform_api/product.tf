module "apim_platform_product_domain" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_product?ref=v8.27.0"

  product_id            = "io-auth-n-identity"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  display_name          = "IO AUTH N IDENTITY PRODUCT"
  description           = "IO AUTH N IDENTITY DOMAIN PRODUCT"
  subscription_required = false
  approval_required     = false
  published             = true

  // product base policy
  policy_xml = file("./${path.module}/api/_base_policy.xml")
}
