module "sm_ca" {
  source  = "pagopa-dx/azure-container-app/azurerm"
  version = "~> 6.0"

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

  secrets = [
    {
      name                = "REDIS_PASSWORD"
      key_vault_secret_id = azurerm_key_vault_secret.sm_redis_access_key.id
    },
  ]

  containers = [
    {
      image = "ghcr.io/pagopa/io-auth-sm"
      name  = "${var.prefix}-${var.domain}-${local.app_name}"

      app_settings = local.app_settings
      secret_names = ["REDIS_PASSWORD"]

      liveness_probe = {
        path = "/api/auth/v2/health/liveness"
      }
      readiness_probe = {
        path = "/api/auth/v2/health/readiness"
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
