module "session_manager" {
  source = "../modules/session_manager"

  prefix         = local.prefix
  env_short      = local.env_short
  location       = local.location
  location_short = local.location_short
  domain         = local.domain
  tags           = local.tags

  resource_group_name = data.azurerm_resource_group.main_resource_group.name
  subscription_id     = data.azurerm_subscription.current.subscription_id

  virtual_network_id                   = data.azurerm_virtual_network.itn_common.id
  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  log_analytics_workspace_id = data.azurerm_log_analytics_workspace.common_law.id

  key_vault = module.key_vaults.auth

  lollipop = {
    base_url  = "https://${module.function_lollipop.function_app.function_app.default_hostname}"
    base_path = "/api/v1"
  }
}
