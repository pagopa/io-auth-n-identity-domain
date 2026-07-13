module "sm_ca" {
  source  = "pagopa-dx/azure-container-app/azurerm"
  version = "~> 5.0"

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    domain          = var.domain
    app_name        = local.app_name
    instance_number = "01"
  }

  container_app_environment_id = module.sm_cae.id

  log_analytics_workspace_id = var.log_analytics_workspace_id

  containers = [
    {
      image = "ghcr.io/pagopa/io-auth-sm"
      name  = "${var.prefix}-${var.domain}-${local.app_name}"

      app_settings = local.app_settings

      liveness_probe = {
        path = "/api/auth/v2/healthcheck"
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
