resource "azurerm_api_management_tag" "app_backend_tag" {
  api_management_id = var.platform_apim_id
  name              = "Auth&Identity"
}
