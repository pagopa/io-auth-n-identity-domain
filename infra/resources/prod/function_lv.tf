data "azurerm_key_vault_secret" "fast_login_subscription_key" {
  name         = "fast-login-subscription-key-v2"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_secret" "backendli_api_key" {
  name         = "appbackend-PRE-SHARED-KEY"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_app_service" "app_backend_li" {
  name                = "${local.common_project}-app-appbackendli"
  resource_group_name = "${local.common_project}-rg-linux"
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
      REDIS_URL      = data.azurerm_redis_cache.core_domain_redis_common.hostname
      REDIS_PORT     = data.azurerm_redis_cache.core_domain_redis_common.ssl_port
      REDIS_PASSWORD = data.azurerm_redis_cache.core_domain_redis_common.primary_access_key

      // --------------------------
      //  Cosmos Config
      // --------------------------
      COSMOS_DB_NAME           = "citizen-auth"
      COSMOS_CONNECTION_STRING = format("AccountEndpoint=%s;AccountKey=%s;", data.azurerm_cosmosdb_account.cosmos_citizen_auth.endpoint, data.azurerm_cosmosdb_account.cosmos_citizen_auth.primary_key)

      // --------------------------
      //  Config for getAssertion
      // --------------------------
      LOLLIPOP_GET_ASSERTION_BASE_URL = "https://api.io.pagopa.it"
      LOLLIPOP_GET_ASSERTION_API_KEY  = data.azurerm_key_vault_secret.fast_login_subscription_key.value

      #   // --------------------------
      #   //  Fast login audit log storage
      #   // --------------------------
      FAST_LOGIN_AUDIT_CONNECTION_STRING = data.azurerm_storage_account.immutable_lv_audit_logs_storage.primary_connection_string


      // --------------------------
      //  Config for backendli connection
      // --------------------------
      BACKEND_INTERNAL_API_KEY  = data.azurerm_key_vault_secret.backendli_api_key.value
      BACKEND_INTERNAL_BASE_URL = "https://${data.azurerm_app_service.app_backend_li.default_site_hostname}"
    }
  }
}


resource "azurerm_resource_group" "function_lv_rg" {
  name     = "${local.project}-${local.domain}-${local.function_lv.name}-rg-01"
  location = local.location

  tags = local.tags
}

module "function_lv" {
  source = "github.com/pagopa/dx//infra/modules/azure_function_app?ref=afcf1f2e91be4f0d0c2bc54bf083f3f7d26d88fc"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_lv.name
    instance_number = "02"
  }

  resource_group_name = azurerm_resource_group.function_lv_rg.name
  health_check_path   = "/info"
  node_version        = 20
  tier                = "xl"

  subnet_cidr                          = local.cidr_subnet_fn_lv
  subnet_pep_id                        = data.azurerm_subnet.private_endpoints_subnet.id
  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings = merge(
    local.function_lv.app_settings
  )
  slot_app_settings = merge(
    local.function_lv.app_settings
  )

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}


module "function_lv_autoscale" {
  depends_on = [azurerm_resource_group.function_lv_rg, module.function_lv]
  source     = "github.com/pagopa/dx//infra/modules/azure_app_service_plan_autoscaler?ref=afcf1f2e91be4f0d0c2bc54bf083f3f7d26d88fc"

  resource_group_name = azurerm_resource_group.function_lv_rg.name
  target_service = {
    function_app_name = module.function_lv.function_app.function_app.name
  }

  scheduler = {
    high_load = {
      name    = "evening"
      minimum = 4
      default = 10
      start = {
        hour    = 19
        minutes = 30
      }
      end = {
        hour    = 22
        minutes = 59
      }
    },
    spot_load = {
      name       = "${module.common_values.scaling_gate.name}"
      minimum    = 6
      default    = 20
      start_date = module.common_values.scaling_gate.start
      end_date   = module.common_values.scaling_gate.end
    },
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