

data "azurerm_key_vault_secret" "low_priority_mailup_username" {
  name         = "low-priority-mailup-username"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_secret" "low_priority_mailup_secret" {
  name         = "low-priority-mailup-secret"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_secret" "function_profile_key" {
  name         = "profile-async-function-profile-key"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_secret" "fn_app_SPID_LOGS_PUBLIC_KEY" {
  name         = "funcapp-KEY-SPIDLOGS-PUB"
  key_vault_id = data.azurerm_key_vault.common_kv.id
}


locals {
  function_profile_async = {
    name = "profas"
    app_settings = {
      NODE_ENV = "production"

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      // Mailup setup
      MAILUP_USERNAME = data.azurerm_key_vault_secret.low_priority_mailup_username.value
      MAILUP_SECRET   = data.azurerm_key_vault_secret.low_priority_mailup_secret.value

      // Mail
      MAIL_FROM = "IO - l'app dei servizi pubblici <no-reply@io.italia.it>"

      // Backend Internal
      BACKEND_INTERNAL_BASE_URL = "https://${data.azurerm_app_service.app_backend_li.default_site_hostname}"
      BACKEND_INTERNAL_API_KEY  = data.azurerm_key_vault_secret.backendli_api_key.value

      // Function Profile
      FUNCTION_PROFILE_BASE_URL = "https://io-p-itn-auth-profile-fn-01.azurewebsites.net"
      FUNCTION_PROFILE_API_KEY  = data.azurerm_key_vault_secret.function_profile_key.value

      // Expired Session Mail prop
      EXPIRED_SESSION_CTA_URL = "https://continua.io.pagopa.it?utm_source=email&utm_medium=email&utm_campaign=lv_expired"

      // Cosmos
      COSMOSDB_NAME              = "db"
      COSMOSDB_CONNECTION_STRING = format("AccountEndpoint=%s;AccountKey=%s;", data.azurerm_cosmosdb_account.cosmos_api.endpoint, data.azurerm_cosmosdb_account.cosmos_api.primary_key)

      //Queue
      EXPIRED_SESSION_ADVISOR_QUEUE = "expired-user-sessions" // TODO: replace when this queue is migrate in the monorepo

      // Storage
      AZURE_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.citizen_auth_common.primary_connection_string

      //MigrateServicePreferenceFromLegacy Config
      IOPSTAPP_STORAGE_CONNECTION_STRING              = data.azurerm_storage_account.storage_app.primary_connection_string
      MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME = "profile-migrate-services-preferences-from-legacy" // TODO: replace when this queue is migrate in the monorepo
      //
      // OnProfileUpdate cosmosDB trigger variables
      ON_PROFILE_UPDATE_LEASES_PREFIX  = "OnProfileUpdateLeasesPrefix-001"
      PROFILE_EMAIL_STORAGE_TABLE_NAME = "profileEmails"

      //StoreSpidLogs Config
      IOPSTLOGS_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.storage_logs.primary_connection_string
      SPID_LOGS_PUBLIC_KEY                = trimspace(data.azurerm_key_vault_secret.fn_app_SPID_LOGS_PUBLIC_KEY.value)
    }
  }
}


module "function_profile_async" {
  source  = "pagopa/dx-azure-function-app/azurerm"
  version = "~> 0.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_profile_async.name
    instance_number = "02"
  }

  node_version      = 20
  health_check_path = "/info"


  resource_group_name = azurerm_resource_group.main_resource_group.name

  subnet_cidr   = local.cidr_subnet_fn_profile_async
  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings = merge(
    local.function_profile_async.app_settings,
    {
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = 5,
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = 5,
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = 5,
      "AzureWebJobs.ExpiredSessionAdvisor.Disabled"                                                    = "0",
      "AzureWebJobs.MigrateServicePreferenceFromLegacy.Disabled"                                       = "0",
      "AzureWebJobs.OnProfileUpdate.Disabled"                                                          = "0"
      "AzureWebJobs.StoreSpidLogs.Disabled"                                                            = "0"
    }
  )
  slot_app_settings = merge(
    local.function_profile_async.app_settings,
    {
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = 100,
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = 100,
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = 100,
      "AzureWebJobs.ExpiredSessionAdvisor.Disabled"                                                    = "1",
      "AzureWebJobs.MigrateServicePreferenceFromLegacy.Disabled"                                       = "1",
      "AzureWebJobs.OnProfileUpdate.Disabled"                                                          = "1"
      "AzureWebJobs.StoreSpidLogs.Disabled"                                                            = "1"
    }
  )

  sticky_app_setting_names = [
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage",
    "AzureWebJobs.ExpiredSessionAdvisor.Disabled",
    "AzureWebJobs.MigrateServicePreferenceFromLegacy.Disabled",
    "AzureWebJobs.OnProfileUpdate.Disabled",
    "AzureWebJobs.StoreSpidLogs.Disabled"
  ]

  subnet_service_endpoints = {
    web = true
  }

  application_insights_connection_string = data.azurerm_application_insights.application_insights.connection_string

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

module "function_profile_async_autoscale" {
  depends_on = [azurerm_resource_group.main_resource_group]
  source     = "pagopa/dx-azure-app-service-plan-autoscaler/azurerm"
  // TODO: in order to update to version 1.0.0, add the required inputs `app_service_plan_id` and `location`
  version = "0.0.2"

  resource_group_name = azurerm_resource_group.main_resource_group.name
  target_service = {
    function_app_name = module.function_profile_async.function_app.function_app.name
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

// ----------------------------------------------------
// Alerts
// ----------------------------------------------------
resource "azurerm_monitor_scheduled_query_rules_alert_v2" "alert_service_preferences_migration_failed" {
  enabled                 = true
  name                    = "[${upper(local.domain)} | ${module.function_profile_async.function_app.function_app.name}] A service preferences migration failed"
  resource_group_name     = azurerm_resource_group.main_resource_group.name
  scopes                  = [data.azurerm_application_insights.application_insights.id]
  description             = "Some service preferences migration did not complete successfully"
  severity                = 1
  auto_mitigation_enabled = false
  location                = local.location

  // check once every day(evaluation_frequency)
  // on the last 24 hours of data(window_duration)
  evaluation_frequency = "P1D"
  window_duration      = "P1D"

  criteria {
    query                   = <<-QUERY
customEvents
| where name == "api.profile.migrate-legacy-preferences"
| extend userId_ = tostring(customDimensions.userId)
| extend action_ = tostring(customDimensions.action)
| summarize make_set(action_, 500) by userId_
| where set_action_ contains "REQUESTING" and not(set_action_ contains "DONE")
    QUERY
    operator                = "GreaterThanOrEqual"
    time_aggregation_method = "Count"
    threshold               = 1
    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  # Action groups for alerts
  action {
    action_groups = [azurerm_monitor_action_group.error_action_group.id]
  }

  tags = local.tags
}
