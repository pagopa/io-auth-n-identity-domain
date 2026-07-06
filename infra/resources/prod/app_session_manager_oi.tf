locals {
  app_session_manager_oi = {
    name = "sm-oi"
    # The Fastify app reads HOST and PORT directly from env, therefore we
    # explicitly bind on all interfaces on port 8080 (aligned with the
    # `WEBSITES_PORT` default used by the Linux App Service runtime).
    listen_port = "8080"

    app_settings = {
      NODE_ENV = "production"

      # The Node runtime does NOT read WEBSITES_PORT to select the port,
      # the app must bind to the port declared here; setting both keeps
      # the App Service HTTP probe aligned with the Fastify listen call.
      WEBSITES_PORT = "8080"
      HOST          = "0.0.0.0"
      PORT          = "8080"

      # Values aligned with the
      # WEU session-manager configuration.
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "128"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      # Lollipop function
      LOLLIPOP_API_URL       = "https://${module.function_lollipop.function_app.function_app.default_hostname}"
      LOLLIPOP_API_BASE_PATH = "/api/v1"
      LOLLIPOP_API_KEY       = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.session_manager_oi_lollipop_api_key.versionless_id})"
    }
  }
}

module "app_session_manager_oi" {
  source  = "pagopa-dx/azure-app-service/azurerm"
  version = "~> 3.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.app_session_manager_oi.name
    instance_number = "01"
  }

  resource_group_name = data.azurerm_resource_group.main_resource_group.name

  stack             = "node"
  node_version      = 22
  health_check_path = "/api/healthcheck"
  tls_version       = 1.2

  use_case = "default"

  subnet_cidr   = local.cidr_subnet_app_session_manager_oi
  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings      = local.app_session_manager_oi.app_settings
  slot_app_settings = local.app_session_manager_oi.app_settings

  application_insights_connection_string = data.azurerm_application_insights.application_insights.connection_string

  tags = local.tags
}

module "app_session_manager_oi_autoscale" {
  source  = "pagopa-dx/azure-app-service-plan-autoscaler/azurerm"
  version = "~> 2.0"

  resource_group_name = data.azurerm_resource_group.main_resource_group.name
  location            = local.location
  app_service_plan_id = module.app_session_manager_oi.app_service.plan.id

  target_service = {
    app_services = [
      {
        name = module.app_session_manager_oi.app_service.app_service.name
      }
    ]
  }

  scheduler = {
    normal_load = {
      minimum = 2
      default = 2
    },
    maximum = 10
  }

  scale_metrics = {
    requests = {
      statistic_increase        = "Max"
      time_window_increase      = 1
      time_aggregation          = "Maximum"
      upper_threshold           = 2000
      increase_by               = 2
      cooldown_increase         = 1
      statistic_decrease        = "Average"
      time_window_decrease      = 5
      time_aggregation_decrease = "Average"
      lower_threshold           = 200
      decrease_by               = 1
      cooldown_decrease         = 1
    }
    cpu = {
      upper_threshold           = 40
      lower_threshold           = 15
      increase_by               = 2
      decrease_by               = 1
      cooldown_increase         = 1
      cooldown_decrease         = 2
      statistic_increase        = "Max"
      statistic_decrease        = "Average"
      time_aggregation_increase = "Maximum"
      time_aggregation_decrease = "Average"
      time_window_increase      = 1
      time_window_decrease      = 5
    }
    memory = null
  }

  tags = local.tags
}
