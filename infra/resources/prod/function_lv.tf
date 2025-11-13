data "azurerm_key_vault_secret" "fast_login_subscription_key" {
  name         = "fast-login-subscription-key"
  key_vault_id = module.key_vaults.auth.id
}

data "azurerm_key_vault_secret" "fast_login_session_manager_internal_api_key" {
  name         = "fast-login-session-manager-internal-key"
  key_vault_id = module.key_vaults.auth.id
}

locals {

  function_lv = {

    name = "lv"

    app_settings = {
      NODE_ENV = "production"

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      // --------------------------
      //  Redis Config
      // --------------------------
      REDIS_URL      = module.redis_common_itn.hostname
      REDIS_PORT     = module.redis_common_itn.ssl_port
      REDIS_PASSWORD = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.redis_access_key_itn.versionless_id})"

      // --------------------------
      //  Config for getAssertion
      // --------------------------
      LOLLIPOP_GET_ASSERTION_BASE_URL = "https://api-internal.io.italia.it"
      LOLLIPOP_GET_ASSERTION_API_KEY  = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.fast_login_subscription_key.versionless_id})"

      // --------------------------
      //  Fast login audit log storage
      // --------------------------
      FAST_LOGIN_AUDIT_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.audit_st_connection_string.versionless_id})"
      FAST_LOGIN_AUDIT_CONTAINER_NAME    = local.lv_audit_logs_container_name

      // --------------------------
      //  Config for session manager internal connection
      // --------------------------
      SESSION_MANAGER_INTERNAL_API_KEY  = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.fast_login_session_manager_internal_api_key.versionless_id})"
      SESSION_MANAGER_INTERNAL_BASE_URL = "https://${module.function_session_manager_internal.function_app.function_app.default_hostname}"
    }

    prod_slot_sampling_percentage = 5
  }
}

data "azurerm_resource_group" "function_lv_rg" {
  name = "${local.project}-${local.domain}-${local.function_lv.name}-rg-01"
}

module "function_lv" {
  source  = "pagopa-dx/azure-function-app/azurerm"
  version = "~> 1.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_lv.name
    instance_number = "02"
  }

  resource_group_name = data.azurerm_resource_group.function_lv_rg.name
  health_check_path   = "/info"
  node_version        = 20
  # P3mv3 SKU and 10 Worker process count
  tier = "xxl"

  subnet_cidr   = local.cidr_subnet_fn_lv
  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id

  subnet_service_endpoints = {
    web = true
  }

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings      = local.function_lv.app_settings
  slot_app_settings = local.function_lv.app_settings

  application_insights_connection_string   = data.azurerm_application_insights.application_insights.connection_string
  application_insights_sampling_percentage = local.function_lv.prod_slot_sampling_percentage

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

module "function_lv_autoscale" {
  source  = "pagopa-dx/azure-app-service-plan-autoscaler/azurerm"
  version = "~> 2.0"

  resource_group_name = data.azurerm_resource_group.function_lv_rg.name
  location            = local.location
  app_service_plan_id = module.function_lv.function_app.plan.id
  target_service = {
    function_apps = [
      {
        name = module.function_lv.function_app.function_app.name
      }
    ]
  }

  scheduler = {
    normal_load = {
      minimum = 15
      default = 15
    },
    maximum = 30
  }

  scale_metrics = {
    requests = {
      statistic_increase        = "Max"
      time_window_increase      = 1
      time_aggregation          = "Maximum"
      upper_threshold           = 2500
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
      upper_threshold           = 35
      lower_threshold           = 15
      increase_by               = 3
      decrease_by               = 1
      cooldown_increase         = 1
      cooldown_decrease         = 20
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
