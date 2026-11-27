data "http" "external_api_ioweb_auth_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/heads/main/apps/io-web-auth-service/api/external.yaml"
}

data "azurerm_api_management_product" "ioweb_product" {
  product_id          = "io-web-api"
  api_management_name = var.apim_name
  resource_group_name = var.apim_resource_group_name
}
