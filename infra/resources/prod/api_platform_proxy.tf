module "io_platform_apim_api_itn" {
  source = "../modules/platform_proxy_api"

  platform_apim_name                = data.azurerm_api_management.platform_apim.name
  platform_apim_resource_group_name = data.azurerm_api_management.platform_apim.resource_group_name
  platform_apim_id                  = data.azurerm_api_management.platform_apim.id

  session_manager_urls = [
    "https://${data.azurerm_linux_web_app.weu_session_manager.default_hostname}/",
    "https://${data.azurerm_linux_web_app.weu_session_manager_bis.default_hostname}/"
  ]

  external_api_base_path = "api/auth"
  bpd_api_base_path      = "api/sso/bpd"
  fims_api_base_path     = "api/sso/fims"
  pagopa_api_base_path   = "api/sso/pagopa"
  zendesk_api_base_path  = "api/sso/zendesk"
}


import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-platform-api-gateway-apim-01/apis/io-session-manager-external-api-v1;rev=2"
  to = module.io_platform_apim_api_itn.azurerm_api_management_api.external_api_session_manager_revision_2
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-platform-api-gateway-apim-01/apis/io-session-manager-external-api-v1;rev=2/operations/login"
  to = module.io_platform_apim_api_itn.azurerm_api_management_api_operation_policy.external_api_session_manager_login_policy
}
