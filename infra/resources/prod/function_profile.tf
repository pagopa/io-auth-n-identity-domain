data "azurerm_key_vault_secret" "fn_app_beta_users" {
  name         = "io-fn-services-BETA-USERS" # reuse common beta list (array of CF)
  key_vault_id = data.azurerm_key_vault.common.id
}

data "azurerm_key_vault_secret" "ioweb_profile_function_api_key" {
  name         = "ioweb-profile-api-key"
  key_vault_id = data.azurerm_key_vault.ioweb_kv.id
}

data "azurerm_key_vault_secret" "common_MAILUP_USERNAME" {
  name         = "common-MAILUP-AI-USERNAME"
  key_vault_id = data.azurerm_key_vault.common.id
}

data "azurerm_key_vault_secret" "common_MAILUP_SECRET" {
  name         = "common-MAILUP-AI-SECRET"
  key_vault_id = data.azurerm_key_vault.common.id
}

data "azurerm_key_vault_secret" "fn_app_PUBLIC_API_KEY" {
  name         = "apim-IO-SERVICE-KEY"
  key_vault_id = data.azurerm_key_vault.common.id
}

data "azurerm_key_vault_secret" "fn_app_SPID_LOGS_PUBLIC_KEY" {
  name         = "funcapp-KEY-SPIDLOGS-PUB"
  key_vault_id = data.azurerm_key_vault.common.id
}

data "azurerm_key_vault_secret" "fn_app_AZURE_NH_ENDPOINT" {
  name         = "common-AZURE-NH-ENDPOINT"
  key_vault_id = data.azurerm_key_vault.common.id
}

data "azurerm_key_vault_secret" "app_backend_UNIQUE_EMAIL_ENFORCEMENT_USER" {
  name         = "appbackend-UNIQUE-EMAIL-ENFORCEMENT-USER"
  key_vault_id = data.azurerm_key_vault.common.id
}

locals {

  function_profile = {

    name = "profile"

    app_settings = {
      NODE_ENV = "production"

      COSMOSDB_NAME              = "db"
      COSMOSDB_URI               = data.azurerm_cosmosdb_account.cosmos_api.endpoint
      COSMOSDB_KEY               = data.azurerm_cosmosdb_account.cosmos_api.primary_key
      COSMOSDB_CONNECTION_STRING = format("AccountEndpoint=%s;AccountKey=%s;", data.azurerm_cosmosdb_account.cosmos_api.endpoint, data.azurerm_cosmosdb_account.cosmos_api.primary_key)

      MESSAGE_CONTAINER_NAME = "message-content"
      QueueStorageConnection = data.azurerm_storage_account.storage_api.primary_connection_string

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      LogsStorageConnection      = data.azurerm_storage_account.logs.primary_connection_string
      AssetsStorageConnection    = data.azurerm_storage_account.assets_cdn.primary_connection_string
      STATUS_ENDPOINT_URL        = "https://api-app.io.pagopa.it/info"
      STATUS_REFRESH_INTERVAL_MS = "300000"

      // TODO: Rename to SUBSCRIPTIONSFEEDBYDAY_TABLE_NAME
      SUBSCRIPTIONS_FEED_TABLE = "SubscriptionsFeedByDay"
      MAIL_FROM                = "IO - l'app dei servizi pubblici <no-reply@io.italia.it>"
      DPO_EMAIL_ADDRESS        = "dpo@pagopa.it"
      PUBLIC_API_URL           = "https://api-app.internal.io.pagopa.it/"
      FUNCTIONS_PUBLIC_URL     = "https://api.io.pagopa.it/public"

      // Push notifications
      AZURE_NH_HUB_NAME                       = "io-p-ntf-common"
      NOTIFICATIONS_QUEUE_NAME                = "push-notifications"
      NOTIFICATIONS_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.notifications.primary_connection_string

      // Service Preferences Migration Queue
      MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME = "profile-migrate-services-preferences-from-legacy"
      FN_APP_STORAGE_CONNECTION_STRING                = data.azurerm_storage_account.iopstapp.primary_connection_string

      // Events configs
      EventsQueueStorageConnection = data.azurerm_storage_account.storage_apievents.primary_connection_string
      EventsQueueName              = "events" # reference to https://github.com/pagopa/io-infra/blob/12a2f3bffa49dab481990fccc9f2a904004862ec/src/core/storage_apievents.tf#L7

      BETA_USERS = data.azurerm_key_vault_secret.fn_app_beta_users.value
      # Enable use of templated email
      FF_TEMPLATE_EMAIL = "ALL"
      # Cashback welcome message
      IS_CASHBACK_ENABLED = "false"
      # Only national service
      FF_ONLY_NATIONAL_SERVICES = "true"
      # Limit the number of local services
      FF_LOCAL_SERVICES_LIMIT = "0"
      # eucovidcert configs
      FF_NEW_USERS_EUCOVIDCERT_ENABLED       = "true"
      EUCOVIDCERT_PROFILE_CREATED_QUEUE_NAME = "eucovidcert-profile-created"

      OPT_OUT_EMAIL_SWITCH_DATE = 1625781600
      FF_OPT_IN_EMAIL_ENABLED   = "true"

      VISIBLE_SERVICE_BLOB_ID = "visible-services-national.json"

      # Login Email variables
      MAGIC_LINK_SERVICE_API_KEY    = data.azurerm_key_vault_secret.ioweb_profile_function_api_key.value
      MAGIC_LINK_SERVICE_PUBLIC_URL = format("https://%s-auth-webprof-func-01.azurewebsites.net", local.project)
      IOWEB_ACCESS_REF              = "https://ioapp.it"
      #

      # UNIQUE EMAIL ENFORCEMENT
      FF_UNIQUE_EMAIL_ENFORCEMENT             = "ALL"
      UNIQUE_EMAIL_ENFORCEMENT_USERS          = jsonencode(split(",", data.azurerm_key_vault_secret.app_backend_UNIQUE_EMAIL_ENFORCEMENT_USER.value))
      PROFILE_EMAIL_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.citizen_auth_common.primary_connection_string
      PROFILE_EMAIL_STORAGE_TABLE_NAME        = "profileEmails"
      ON_PROFILE_UPDATE_LEASES_PREFIX         = "OnProfileUpdateLeasesPrefix-001"

      MAILUP_USERNAME      = data.azurerm_key_vault_secret.common_MAILUP_USERNAME.value
      MAILUP_SECRET        = data.azurerm_key_vault_secret.common_MAILUP_SECRET.value
      PUBLIC_API_KEY       = trimspace(data.azurerm_key_vault_secret.fn_app_PUBLIC_API_KEY.value)
      SPID_LOGS_PUBLIC_KEY = trimspace(data.azurerm_key_vault_secret.fn_app_SPID_LOGS_PUBLIC_KEY.value)
      AZURE_NH_ENDPOINT    = data.azurerm_key_vault_secret.fn_app_AZURE_NH_ENDPOINT.value
    }

    #List of the functions'name to be disabled in both prod and slot
    functions_disabled = [
      "OnProfileUpdate",
      "StoreSpidLogs",
      "MigrateServicePreferenceFromLegacy"
    ]
  }
}

resource "azurerm_resource_group" "function_profile_rg_01" {
  name     = "${local.project}-${local.domain}-${local.function_profile.name}-rg-01"
  location = local.location

  tags = local.tags
}

module "function_profile_03" {
  source = "github.com/pagopa/dx//infra/modules/azure_function_app?ref=ced44ee90696a9569bb36e23a837f7e7581bf6f7"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_profile.name
    instance_number = "03"
  }

  resource_group_name = azurerm_resource_group.function_profile_rg_01.name
  health_check_path   = "/api/v1/info"
  node_version        = 18

  subnet_cidr   = local.cidr_subnet_fn_profile
  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id

  subnet_service_endpoints = {
    web = true
  }

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings = merge(
    local.function_profile.app_settings,
    {
      # Disabled functions on slot triggered by cosmosDB change feed
      for to_disable in local.function_profile.functions_disabled :
      format("AzureWebJobs.%s.Disabled", to_disable) => "1"
    }
  )
  slot_app_settings = merge(
    local.function_profile.app_settings,
    {
      # Disabled functions on slot triggered by cosmosDB change feed
      for to_disable in local.function_profile.functions_disabled :
      format("AzureWebJobs.%s.Disabled", to_disable) => "1"
    }
  )

  sticky_app_setting_names = concat(
    [
      for to_disable in local.function_profile.functions_disabled :
      format("AzureWebJobs.%s.Disabled", to_disable)
    ]
  )

  application_insights_key = data.azurerm_application_insights.application_insights.instrumentation_key

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

module "function_profile_autoscale" {
  depends_on = [azurerm_resource_group.function_profile_rg_01]
  source     = "github.com/pagopa/dx//infra/modules/azure_app_service_plan_autoscaler?ref=ced44ee90696a9569bb36e23a837f7e7581bf6f7"

  resource_group_name = azurerm_resource_group.function_profile_rg_01.name
  target_service = {
    function_app_name = module.function_profile_03.function_app.function_app.name
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
