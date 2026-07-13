module "sm_cae" {
  source  = "pagopa-dx/azure-container-app-environment/azurerm"
  version = "~> 2.0"

  resource_group_name = var.resource_group_name

  networking = {
    virtual_network_id                   = var.virtual_network_id
    private_dns_zone_resource_group_name = var.private_dns_zone_resource_group_name
  }

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    domain          = var.domain
    app_name        = local.app_name
    instance_number = "01"
  }

  log_analytics_workspace_id = var.log_analytics_workspace_id

  tags = var.tags
}

