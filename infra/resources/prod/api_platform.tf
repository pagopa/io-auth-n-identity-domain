module "io_platform_apim_api_itn" {
  source = "../../modules/platform_api"

  platform_apim_name                = data.azurerm_api_management.platform_apim.name
  platform_apim_resource_group_name = data.azurerm_api_management.platform_apim.resource_group_name
  platform_apim_id                  = data.azurerm_api_management.platform_apim.id

  session_manager_url    = "https://${data.azurerm_linux_web_app.weu_session_manager.default_hostname}/"
  session_manager_prefix = "session-manager"

  bpd_api_base_path                 = "bpd/api/v1"
  fast_login_api_base_path          = "api/v1"
  fims_api_base_path                = "fims/api/v1"
  pagopa_api_base_path              = "pagopa/api/v1"
  token_introspection_api_base_path = "api/v1"
  zendesk_api_base_path             = "api/backend/zendesk/v1"
}
