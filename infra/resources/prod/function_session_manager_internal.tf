data "azurerm_key_vault_secret" "events_beta_testers" {
  name         = "service-bus-events-beta-testers"
  key_vault_id = data.azurerm_key_vault.kv.id
}

locals {
  function_session_manager_internal = {
    name = "sm-int"
    app_settings = {
      NODE_ENV = "production"

      # Redis Config
      REDIS_URL         = data.azurerm_redis_cache.redis_common.hostname
      REDIS_PORT        = data.azurerm_redis_cache.redis_common.ssl_port
      REDIS_PASSWORD    = data.azurerm_redis_cache.redis_common.primary_access_key
      REDIS_TLS_ENABLED = "true"

      APPINSIGHTS_REDIS_TRACE_ENABLED = "true"

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      // Revoke assertion ref queue config
      LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.lollipop_assertion_storage.primary_connection_string
      LOLLIPOP_REVOKE_QUEUE_NAME                = "pubkeys-revoke-v2"

      // User authenticaiton locks table config
      LOCKED_PROFILES_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.locked_profiles_storage.primary_connection_string
      LOCKED_PROFILES_TABLE_NAME                = "lockedprofiles"

      // Clear installation queue config
      PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.push_notifications_storage.primary_connection_string
      PUSH_NOTIFICATIONS_QUEUE_NAME                = "push-notifications"

      // Service Bus Config
      SERVICE_BUS_NAMESPACE    = "${data.azurerm_servicebus_namespace.platform_service_bus_namespace.name}.servicebus.windows.net"
      AUTH_SESSIONS_TOPIC_NAME = azurerm_servicebus_topic.io_auth_sessions_topic.name
      FF_SERVICE_BUS_EVENTS    = "BETA"
      SERVICE_BUS_EVENTS_USERS = data.azurerm_key_vault_secret.events_beta_testers.value
    }
  }
}



module "function_session_manager_internal" {
  source  = "pagopa-dx/azure-function-app/azurerm"
  version = "~> 0.0"

  # Note: SM and SM-int must be deployed in the WEU region to ensure connectivity with Redis.
  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.weu_location
    domain          = local.domain
    app_name        = local.function_session_manager_internal.name
    instance_number = "01"
  }

  node_version      = 20
  health_check_path = "/api/v1/info"

  tier = "l"


  resource_group_name = data.azurerm_resource_group.main_resource_group.name

  subnet_cidr   = local.cidr_subnet_fn_session_manager_internal
  subnet_pep_id = data.azurerm_subnet.weu_private_endpoints_subnet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.weu_common.name
    resource_group_name = data.azurerm_virtual_network.weu_common.resource_group_name
  }

  app_settings      = local.function_session_manager_internal.app_settings
  slot_app_settings = local.function_session_manager_internal.app_settings

  subnet_service_endpoints = {
    web = true
  }

  application_insights_connection_string = data.azurerm_application_insights.application_insights.connection_string

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

module "function_session_manager_internal_autoscale" {
  source = "pagopa-dx/azure-app-service-plan-autoscaler/azurerm"
  // TODO: in order to update to version 1.0.0, add the required inputs `app_service_plan_id` and `location`
  version = "~> 0.0"

  resource_group_name = data.azurerm_resource_group.main_resource_group.name
  target_service = {
    function_app_name = module.function_session_manager_internal.function_app.function_app.name
  }

  scheduler = {
    normal_load = {
      minimum = 3
      default = 10
    },
    maximum = 30
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
      increase_by               = 4
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
