module "apim_v2_product_public" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_product?ref=v7.40.3"

  product_id            = "io-public-api"
  api_management_name   = var.apim_name
  resource_group_name   = var.apim_resource_group_name
  display_name          = "IO PUBLIC API"
  description           = "PUBLIC API for IO platform."
  subscription_required = false
  approval_required     = false
  published             = true

  policy_xml = file("./${path.module}/api/_base_policy.xml")
}

# Named Value io_fn3_public_url
resource "azurerm_api_management_named_value" "io_fn3_public_url_v2" {
  name                = "io-fn3-public-url"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "io-fn3-public-url"
  value               = var.function_public_url
}

resource "azurerm_api_management_named_value" "io_fn3_public_key_v2" {
  name                = "io-fn3-public-key"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  display_name        = "io-fn3-public-key"
  value               = data.azurerm_key_vault_secret.io_fn3_public_key_secret_v2.value
  secret              = "true"
}

# API Version Set
resource "azurerm_api_management_api_version_set" "public_api_version_set" {
  name                = "io-public-api-version-set"
  resource_group_name = var.apim_resource_group_name
  api_management_name = var.apim_name
  display_name        = "IO Public API"
  versioning_scheme   = "Segment"
}

module "api_v2_public" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.40.3"

  name                = "io-public-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  revision            = "1"
  display_name        = "IO PUBLIC API"
  description         = "PUBLIC API for IO platform."

  path        = "public"
  protocols   = ["https"]
  product_ids = [module.apim_v2_product_public.product_id]

  version_set_id = azurerm_api_management_api_version_set.public_api_version_set.id

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


module "api_v2_public_io_web_profile" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.40.3"

  name                = "io-public-api-v2"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
  revision            = "1"
  display_name        = "IO PUBLIC API V2"
  description         = "PUBLIC API for IO platform."

  path        = "public/api"
  protocols   = ["https"]
  product_ids = [module.apim_v2_product_public.product_id]

  version_set_id = azurerm_api_management_api_version_set.public_api_version_set.id
  api_version    = "v2"

  service_url = null

  subscription_required = false

  content_format = "openapi"
  content_value = templatefile("./${path.module}/api/v2/_swagger.yaml.tpl",
    {
      host     = var.api_host_name
      basePath = "public/api/v2"
    }
  )

  xml_content = file("./${path.module}/api/v2/policy.xml")
}
