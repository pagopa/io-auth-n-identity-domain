module "io_platform_apim_api_itn" {
  source = "../../modules/platform_api"

  platform_apim_name                = data.azurerm_api_management.platform_apim.name
  platform_apim_resource_group_name = data.azurerm_api_management.platform_apim.resource_group_name
  platform_apim_id                  = data.azurerm_api_management.platform_apim.id

  session_manager_url = "https://${data.azurerm_linux_web_app.weu_session_manager.default_hostname}/"

  bpd_api_base_path      = "api/sso/bpd"
  fims_api_base_path     = "api/sso/fims"
  pagopa_api_base_path   = "api/sso/pagopa"
  external_api_base_path = "api/auth"
  zendesk_api_base_path  = "api/sso/zendesk"
}
