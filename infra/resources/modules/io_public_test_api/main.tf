module "apim_v2_product_public_test" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_product?ref=v7.40.3"

  product_id            = "io-public-test-api"
  api_management_name   = var.apim_name
  resource_group_name   = var.apim_resource_group_name
  display_name          = "IO PUBLIC TEST API"
  description           = "PUBLIC TEST API for IO platform."
  subscription_required = false
  approval_required     = false
  published             = true

  policy_xml = file("./${path.module}/api/_base_policy.xml")
}

module "api_v2_public_test" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.40.3"

  name                = "io-public-test-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  revision            = "1"
  display_name        = "IO PUBLIC TEST API"
  description         = "PUBLIC TEST API for IO platform."

  path        = "public-test"
  protocols   = ["https"]
  product_ids = [module.apim_v2_product_public_test.product_id]

  service_url = null

  subscription_required = false

  content_format = "swagger-json"
  content_value = templatefile("./${path.module}/api/v1/_swagger.json.tpl",
    {
      host = var.api_host_name
    }
  )

  xml_content = file("./${path.module}/api//v1/policy.xml")
}
