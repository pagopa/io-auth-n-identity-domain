module "managed_redis" {
  source  = "pagopa-dx/azure-managed-redis/azurerm"
  version = "~> 3.0"

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    app_name        = local.app_name
    instance_number = "01"
  }

  resource_group_name = var.resource_group_name

  # "default" use case enables high availability (zone redundancy, persistence)
  use_case = "default"
  # Network performance "moderate", 1GB size and 2 vCPUs
  sku_name_override = "Balanced_B1"

  virtual_network_id                   = var.virtual_network_id
  private_dns_zone_resource_group_name = var.private_dns_zone_resource_group_name

  log_analytics_workspace_id = var.log_analytics_workspace_id

  alerts = {
    action_group_id = var.action_group_id
  }

  tags = var.tags
}
