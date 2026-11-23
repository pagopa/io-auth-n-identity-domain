resource "azurerm_api_management_backend" "ioweb_auth_service_backends" {
  count               = length(local.ioweb_auth_service_urls)
  title               = "IO-WEB auth service ${count.index + 1}"
  name                = "ioweb-auth-service-backend-${count.index + 1}"
  resource_group_name = var.apim_resource_group_name
  api_management_name = var.apim_name
  protocol            = "http"
  url                 = local.ioweb_auth_service_urls[count.index]
}

resource "azapi_resource" "ioweb_auth_service_pool" {
  type      = "Microsoft.ApiManagement/service/backends@2024-06-01-preview"
  name      = local.apim_pool_name
  parent_id = var.apim_id
  body = {
    properties = {
      protocol    = null
      url         = null
      type        = "Pool"
      description = "Load Balancer of IO-WEB Auth Services"
      pool = {
        services = [
          for backend in azurerm_api_management_backend.ioweb_auth_service_backends : {
            id = backend.id
          }
        ]
      }
    }
  }
}
