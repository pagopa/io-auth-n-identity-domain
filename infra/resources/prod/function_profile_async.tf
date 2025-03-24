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
    app_settings = [
      {
        name  = "NODE_ENV"
        value = "production"
      },
      {
        name  = "FETCH_KEEPALIVE_ENABLED",
        value = "true"
      },
      {
        name  = "FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL",
        value = "110000"
      },
      {
        name  = "FETCH_KEEPALIVE_MAX_SOCKETS",
        value = "40"
      },
      {
        name  = "FETCH_KEEPALIVE_MAX_FREE_SOCKETS",
        value = "10"
      },
      {
        name  = "FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT",
        value = "30000"
      },
      {
        name  = "FETCH_KEEPALIVE_TIMEOUT",
        value = "60000"
      },
      {
        name  = "MAIL_FROM",
        value = "IO - l'app dei servizi pubblici <no-reply@io.italia.it>"
      },
      {
        name  = "BACKEND_INTERNAL_BASE_URL",
        value = "https://${data.azurerm_linux_web_app.app_backend_li.default_hostname}"
      },
      {
        name                 = "BACKEND_INTERNAL_API_KEY",
        key_vault_secret_uri = data.azurerm_key_vault_secret.backendli_api_key.versionless_id
      },
      {
        name  = "FUNCTION_PROFILE_BASE_URL",
        value = "https://io-p-itn-auth-profile-fn-01.azurewebsites.net"
      },
      {
        name                 = "FUNCTION_PROFILE_API_KEY",
        key_vault_secret_uri = data.azurerm_key_vault_secret.function_profile_key.versionless_id
      },
      {
        name  = "EXPIRED_SESSION_CTA_URL",
        value = "https://continua.io.pagopa.it?utm_source=email&utm_medium=email&utm_campaign=lv_expired"
      },
      {
        name  = "COSMOSDB_NAME",
        value = "db"
      },
      {
        name                 = "COSMOSDB_CONNECTION_STRING",
        key_vault_secret_uri = azurerm_key_vault_secret.cosmos_api_connection_string.versionless_id
      },
      {
        name  = "EXPIRED_SESSION_ADVISOR_QUEUE",
        value = "expired-user-sessions"
      },
      {
        name                 = "AZURE_STORAGE_CONNECTION_STRING",
        key_vault_secret_uri = azurerm_key_vault_secret.citizen_auth_common_connection_string.versionless_id
      },
      {
        name                 = "IOPSTAPP_STORAGE_CONNECTION_STRING",
        key_vault_secret_uri = azurerm_key_vault_secret.iopstapp_connection_string.versionless_id
      },
      {
        name  = "MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME",
        value = "profile-migrate-services-preferences-from-legacy"
      },
      {
        name  = "ON_PROFILE_UPDATE_LEASES_PREFIX",
        value = "OnProfileUpdateLeasesPrefix-001"
      },
      {
        name  = "PROFILE_EMAIL_STORAGE_TABLE_NAME",
        value = "profileEmails"
      },
      {
        name                 = "IOPSTLOGS_STORAGE_CONNECTION_STRING",
        key_vault_secret_uri = azurerm_key_vault_secret.iopstlogs_connection_string.versionless_id
      },
      {
        name                 = "SPID_LOGS_PUBLIC_KEY",
        key_vault_secret_uri = data.azurerm_key_vault_secret.fn_app_SPID_LOGS_PUBLIC_KEY.versionless_id
      }
    ]
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

  app_settings = merge({
    "AzureWebJobs.ExpiredSessionAdvisor.Disabled"                                                    = "0",
    "AzureWebJobs.MigrateServicePreferenceFromLegacy.Disabled"                                       = "0",
    "AzureWebJobs.OnProfileUpdate.Disabled"                                                          = "0",
    "AzureWebJobs.StoreSpidLogs.Disabled"                                                            = "0",
    MAILUP_USERNAME                                                                                  = "@Microsoft.KeyVault(SecretUri=https://io-p-citizen-auth-kv.vault.azure.net/secrets/low-priority-mailup-username)",
    MAILUP_SECRET                                                                                    = "@Microsoft.KeyVault(SecretUri=https://io-p-citizen-auth-kv.vault.azure.net/secrets/low-priority-mailup-secret)",
    AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = 5,
    AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = 5,
    AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = 5,
    },
    {
      for s in local.function_profile_async.app_settings :
      s.name => try("@Microsoft.KeyVault(SecretUri=${s.key_vault_secret_uri})", s.value)
    }
  )
  slot_app_settings = merge({
    "AzureWebJobs.ExpiredSessionAdvisor.Disabled"                                                    = "1",
    "AzureWebJobs.MigrateServicePreferenceFromLegacy.Disabled"                                       = "1",
    "AzureWebJobs.OnProfileUpdate.Disabled"                                                          = "1"
    "AzureWebJobs.StoreSpidLogs.Disabled"                                                            = "1"
    MAILUP_USERNAME                                                                                  = "dummy",
    MAILUP_SECRET                                                                                    = "dummy",
    AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = 100,
    AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = 100,
    AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = 100,
    },
    {
      for s in local.function_profile_async.app_settings :
      s.name => try("@Microsoft.KeyVault(SecretUri=${s.key_vault_secret_uri})", s.value)
    }
  )

  sticky_app_setting_names = [
    "AzureWebJobs.ExpiredSessionAdvisor.Disabled",
    "AzureWebJobs.MigrateServicePreferenceFromLegacy.Disabled",
    "AzureWebJobs.OnProfileUpdate.Disabled",
    "AzureWebJobs.StoreSpidLogs.Disabled",
    "MAILUP_USERNAME",
    "MAILUP_SECRET",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage",
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
