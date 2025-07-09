module "io_profile_apim_api_itn" {
  source = "../modules/operation_api"

  apim_name                = local.apim_itn_name
  apim_resource_group_name = local.apim_itn_resource_group_name

  key_vault_common_id = data.azurerm_key_vault.common_kv.id

  function_profile_url = "https://${module.function_profile.function_app.function_app.default_hostname}"
  function_admin_url   = "https://io-p-admin-fn.azurewebsites.net"

  api_host_name = "api.io.pagopa.it"
}
