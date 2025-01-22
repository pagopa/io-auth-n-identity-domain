module "io_profile_apim_api_weu" {
  source = "../../modules/operation_api"

  apim_name                = local.apim_v2_name
  apim_resource_group_name = local.apim_resource_group_name

  key_vault_common_id = data.azurerm_key_vault.common_kv.id
  
  application_internal_endpoint = "https://io-p-itn-auth-profile-fn-01.azurewebsites.net"

  api_host_name = "api.io.pagopa.it"
}
