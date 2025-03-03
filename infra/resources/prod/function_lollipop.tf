data "azurerm_key_vault_secret" "first_lollipop_consumer_subscription_key" {
  name         = "first-lollipop-consumer-pagopa-subscription-key-v2" # itn" Change it for itn switch
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_certificate_data" "lollipop_certificate_v1" {
  name         = "lollipop-certificate-v1"
  key_vault_id = data.azurerm_key_vault.kv.id
}

locals {
  function_lollipop = {
    name = "lollipop"

    app_settings = {
      NODE_ENV = "production"

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      COSMOSDB_NAME                = "citizen-auth"
      COSMOSDB_URI                 = data.azurerm_cosmosdb_account.cosmos_citizen_auth.endpoint
      COSMOSDB_KEY                 = data.azurerm_cosmosdb_account.cosmos_citizen_auth.primary_key
      COSMOS_API_CONNECTION_STRING = format("AccountEndpoint=%s;AccountKey=%s;", data.azurerm_cosmosdb_account.cosmos_citizen_auth.endpoint, data.azurerm_cosmosdb_account.cosmos_citizen_auth.primary_key)

      #TODO: move to new storage on itn
      LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.lollipop_assertion_storage.primary_connection_string
      LOLLIPOP_ASSERTION_REVOKE_QUEUE              = "pubkeys-revoke-v2"

      // ------------
      // JWT Config
      // ------------
      ISSUER = local.lollipop_jwt_host

      PRIMARY_PRIVATE_KEY = trimspace(data.azurerm_key_vault_certificate_data.lollipop_certificate_v1.key)
      PRIMARY_PUBLIC_KEY  = trimspace(data.azurerm_key_vault_certificate_data.lollipop_certificate_v1.pem)

      // Use it during rotation period. See https://pagopa.atlassian.net/wiki/spaces/IC/pages/645136398/LolliPoP+Procedura+di+rotazione+dei+certificati
      //SECONDARY_PUBLIC_KEY =

      // -------------------------
      // First LolliPoP Consumer
      // -------------------------
      FIRST_LC_ASSERTION_CLIENT_BASE_URL         = "https://api.io.pagopa.it"
      FIRST_LC_ASSERTION_CLIENT_SUBSCRIPTION_KEY = data.azurerm_key_vault_secret.first_lollipop_consumer_subscription_key.value
    }

    prod_slot_sampling_percentage    = 5
    staging_slot_sampling_percentage = 100
  }
}

resource "azurerm_resource_group" "function_lollipop_rg" {
  name     = "${local.project}-${local.domain}-${local.function_lollipop.name}-rg-02"
  location = local.location

  tags = local.tags
}

module "function_lollipop" {
  source  = "pagopa/dx-azure-function-app/azurerm"
  version = "~> 0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_lollipop.name
    instance_number = "02"
  }

  resource_group_name = azurerm_resource_group.function_lollipop_rg.name
  health_check_path   = "/info"
  node_version        = 20
  # P2mv3 SKU and 8 Worker process count
  tier = "xl"

  subnet_cidr   = local.cidr_subnet_fn_lollipop
  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings = merge(
    local.function_lollipop.app_settings,
    {
      "AzureWebJobs.HandlePubKeyRevoke.Disabled"                                                       = "0"
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = local.function_lollipop.prod_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = local.function_lollipop.prod_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = local.function_lollipop.prod_slot_sampling_percentage
    },
  )
  slot_app_settings = merge(
    local.function_lollipop.app_settings,
    {
      "AzureWebJobs.HandlePubKeyRevoke.Disabled"                                                       = "1"
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = local.function_lollipop.staging_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = local.function_lollipop.staging_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = local.function_lollipop.staging_slot_sampling_percentage
    },
  )

  sticky_app_setting_names = [
    "AzureWebJobs.HandlePubKeyRevoke.Disabled",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage",
  ]

  application_insights_connection_string = data.azurerm_application_insights.application_insights.connection_string

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

module "function_lollipop_autoscale" {
  depends_on = [azurerm_resource_group.function_lollipop_rg]
  source     = "pagopa/dx-azure-app-service-plan-autoscaler/azurerm"
  // TODO: in order to update to version 1.0.0, add the required inputs `app_service_plan_id` and `location`
  version = "0.0.2"

  resource_group_name = azurerm_resource_group.function_lollipop_rg.name
  target_service = {
    function_app_name = module.function_lollipop.function_app.function_app.name
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
      #################
      # scale out
      #################
      statistic_increase   = "Max"
      time_window_increase = 1
      time_aggregation     = "Maximum"
      upper_threshold      = 3000
      increase_by          = 2
      cooldown_increase    = 1
      #################
      # scale in
      #################
      statistic_decrease        = "Average"
      time_window_decrease      = 5
      time_aggregation_decrease = "Average"
      lower_threshold           = 300
      decrease_by               = 1
      cooldown_decrease         = 1
    }
    cpu = {
      #################
      # scale out
      #################
      statistic_increase        = "Max"
      time_window_increase      = 1
      time_aggregation_increase = "Maximum"
      upper_threshold           = 35
      increase_by               = 4
      cooldown_increase         = 1
      #################
      # scale in
      #################
      statistic_decrease        = "Average"
      time_window_decrease      = 5
      time_aggregation_decrease = "Average"
      lower_threshold           = 15
      decrease_by               = 1
      cooldown_decrease         = 2
    }
    memory = null
  }

  tags = local.tags
}
