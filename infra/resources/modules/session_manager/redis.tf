module "managed_redis" {
  source  = "pagopa-dx/azure-managed-redis/azurerm"
  version = "~> 1.0"

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    domain          = var.domain
    app_name        = local.app_name
    instance_number = "01"
  }

  resource_group_name = var.resource_group_name

  use_case = "default"

  virtual_network_id                   = var.virtual_network_id
  private_dns_zone_resource_group_name = var.private_dns_zone_resource_group_name

  log_analytics_workspace_id = var.log_analytics_workspace_id

  tags = var.tags
}
