module "auth_service_cae" {
  source  = "pagopa-dx/azure-container-app-environment/azurerm"
  version = "~> 5.0"

  resource_group_name = var.resource_group_name

  networking = {
    virtual_network_id                   = var.virtual_network_id
    private_dns_zone_resource_group_name = var.private_dns_zone_resource_group_name
  }

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    app_name        = local.app_name
    instance_number = "01"
  }

  log_analytics_workspace_id = var.log_analytics_workspace_id

  tags = var.tags
}

module "auth_service_ca" {
  source  = "pagopa-dx/azure-container-app/azurerm"
  version = "~> 9.0"

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    app_name        = local.app_name
    instance_number = "01"
  }

  container_app_environment_id = module.auth_service_cae.id

  log_analytics_workspace_id = var.log_analytics_workspace_id

  containers = [
    {
      image = local.auth_ca_image
      name  = "${local.app_name}-service"

      environment_variables = local.environment_variables
      liveness_probe = {
        path = "/health/liveness"
      }
      readiness_probe = {
        path = "/health/readiness"
      }
    },
  ]

  autoscaler = {
    replicas = {
      minimum = 1
      maximum = 8
    }
  }

  container_port = local.listen_port

  resource_group_name = var.resource_group_name

  tags = var.tags
}

module "auth_ca_iam" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 5.0"

  subscription_id = var.subscription_id
  principal_id    = module.auth_service_ca.principal_id

  key_vault = [{
    name                = var.key_vault.name
    resource_group_name = var.key_vault.resource_group_name
    description         = "Allow the ioweb auth Container App to read secrets"
    roles = {
      secrets = "reader"
    }
  }]

  managed_redis = [{
    id          = module.managed_redis.id
    role        = "writer"
    description = "Allow the ioweb auth Container App to read/write the Azure Managed Redis cache"
  }]
}

resource "azurerm_role_assignment" "auth_ca_appinsights_metrics_publisher" {
  scope                = var.application_insights.id
  role_definition_name = "Monitoring Metrics Publisher"
  principal_id         = module.auth_service_ca.principal_id
  description          = "Allow the ioweb auth Container App to publish telemetry to Application Insights"
}
