module "sm_ca" {
  source  = "pagopa-dx/azure-container-app/azurerm"
  version = "~> 8.0"

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

      environment_variables = concat(local.env_vars_common, local.env_vars_sm)
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

module "sm_int_ca" {
  source  = "pagopa-dx/azure-container-app/azurerm"
  version = "~> 8.0"

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    domain          = var.domain
    app_name        = "${local.app_name}-int"
    instance_number = "01"
  }

  container_app_environment_id = module.sm_cae.id

  log_analytics_workspace_id = var.log_analytics_workspace_id

  containers = [
    {
      image = "ghcr.io/pagopa/io-auth-session-manager-internal"
      name  = "${var.prefix}-${var.domain}-${local.app_name}-int"

      environment_variables = concat(local.env_vars_common, local.env_vars_sm_int)
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
      maximum = 4
    }
  }

  container_port = local.listen_port

  resource_group_name = var.resource_group_name

  tags = var.tags
}
