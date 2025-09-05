data "azurerm_key_vault_secret" "ioweb_profile_function_api_key" {
  name         = "ioweb-profile-api-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "common_MAILUP_USERNAME" {
  name         = "common-MAILUP-AI-USERNAME"
  key_vault_id = data.azurerm_key_vault.common_kv.id
}

data "azurerm_key_vault_secret" "common_MAILUP_SECRET" {
  name         = "common-MAILUP-AI-SECRET"
  key_vault_id = data.azurerm_key_vault.common_kv.id
}

data "azurerm_key_vault_secret" "fn_app_PUBLIC_API_KEY" {
  name         = "apim-IO-SERVICE-KEY"
  key_vault_id = data.azurerm_key_vault.common_kv.id
}

locals {
  function_profile = {
    name = "profile"
    app_settings = {
      NODE_ENV = "production"

      COSMOSDB_NAME              = "db"
      COSMOSDB_CONNECTION_STRING = format("AccountEndpoint=%s;AccountKey=%s;", data.azurerm_cosmosdb_account.cosmos_api.endpoint, data.azurerm_cosmosdb_account.cosmos_api.primary_key)

      QueueStorageConnection = data.azurerm_storage_account.storage_api.primary_connection_string

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      // TODO: Rename to SUBSCRIPTIONSFEEDBYDAY_TABLE_NAME
      SUBSCRIPTIONS_FEED_TABLE = "SubscriptionsFeedByDay"
      MAIL_FROM                = "IO - l'app dei servizi pubblici <no-reply@io.italia.it>"
      DPO_EMAIL_ADDRESS        = "dpo@pagopa.it" //TODO: seems to not be used anymore
      PUBLIC_API_URL           = "https://api-app.internal.io.pagopa.it/"
      FUNCTIONS_PUBLIC_URL     = "https://api.io.pagopa.it/public"

      // Service Preferences Migration Queue
      MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME        = local.profile_migrate_services_preferences_from_legacy_queue_name
      IOPSTAPP_STORAGE_CONNECTION_STRING                     = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.maintenance_st_connection_string.versionless_id})"
      MIGRATE_SERVICES_PREFERENCES_PROFILE_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.maintenance_st_connection_string.versionless_id})"

      // Events configs
      EventsQueueStorageConnection = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.maintenance_st_connection_string.versionless_id})"
      EventsQueueName              = local.profile_events_queue_name

      # Cashback welcome message
      IS_CASHBACK_ENABLED = "false"

      OPT_OUT_EMAIL_SWITCH_DATE = 1625781600

      # Login Email variables
      MAGIC_LINK_SERVICE_API_KEY    = data.azurerm_key_vault_secret.ioweb_profile_function_api_key.value
      MAGIC_LINK_SERVICE_PUBLIC_URL = "https://${module.function_web_profile.function_app.function_app.default_hostname}"
      IOWEB_ACCESS_REF              = "https://account.ioapp.it"

      PROFILE_EMAIL_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.citizen_auth_common.primary_connection_string
      PROFILE_EMAIL_STORAGE_TABLE_NAME        = "profileEmails"

      MAILUP_USERNAME = data.azurerm_key_vault_secret.common_MAILUP_USERNAME.value
      MAILUP_SECRET   = data.azurerm_key_vault_secret.common_MAILUP_SECRET.value
      PUBLIC_API_KEY  = trimspace(data.azurerm_key_vault_secret.fn_app_PUBLIC_API_KEY.value)
    }
  }
}

resource "azurerm_key_vault_access_policy" "func_profile_kv_common" {
  key_vault_id = data.azurerm_key_vault.common_kv.id
  object_id    = module.function_profile.function_app.function_app.principal_id
  tenant_id    = data.azurerm_subscription.current.tenant_id

  secret_permissions = [
    "Get"
  ]
}

resource "azurerm_key_vault_access_policy" "func_profile_staging_kv_common" {
  key_vault_id = data.azurerm_key_vault.common_kv.id
  object_id    = module.function_profile.function_app.function_app.slot.principal_id
  tenant_id    = data.azurerm_subscription.current.tenant_id

  secret_permissions = [
    "Get"
  ]
}

module "function_profile" {
  source  = "pagopa-dx/azure-function-app/azurerm"
  version = "~> 1.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_profile.name
    instance_number = "02"
  }

  node_version          = 20
  health_check_path     = "/api/v1/info"
  has_durable_functions = "true"

  # P2mv3 SKU and 8 Worker process count(sku set as of io-infra function-profile definition)
  tier = "xl"

  resource_group_name = data.azurerm_resource_group.main_resource_group.name

  subnet_cidr   = local.cidr_subnet_fn_profile
  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings      = local.function_profile.app_settings
  slot_app_settings = local.function_profile.app_settings

  subnet_service_endpoints = {
    web = true
  }

  application_insights_connection_string = data.azurerm_application_insights.application_insights.connection_string

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

module "function_profile_autoscale" {
  source  = "pagopa-dx/azure-app-service-plan-autoscaler/azurerm"
  version = "~> 2.0"

  resource_group_name = data.azurerm_resource_group.main_resource_group.name
  location            = local.location
  app_service_plan_id = module.function_profile.function_app.plan.id
  target_service = {
    function_apps = [
      {
        name = module.function_profile.function_app.function_app.name
      }
    ]
  }

  scheduler = {
    high_load = {
      name    = "evening"
      minimum = 10
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
    normal_load = {
      minimum = 6
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
