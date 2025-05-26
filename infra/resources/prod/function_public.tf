

locals {
  function_public = {
    name = "public"
    app_settings = {
      NODE_ENV = "production"

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      # UNIQUE EMAIL ENFORCEMENT
      PROFILE_EMAIL_STORAGE_CONNECTION_STRING = data.azurerm_storage_account.citizen_auth_common.primary_connection_string
      PROFILE_EMAIL_STORAGE_TABLE_NAME        = "profileEmails"

      COSMOSDB_URI  = data.azurerm_cosmosdb_account.cosmos_api.endpoint
      COSMOSDB_KEY  = data.azurerm_cosmosdb_account.cosmos_api.primary_key
      COSMOSDB_NAME = "db"

      StorageConnection = data.azurerm_storage_account.storage_api.primary_connection_string

      VALIDATION_CALLBACK_URL = "https://api-app.io.pagopa.it/email_verification.html"
      CONFIRM_CHOICE_PAGE_URL = "https://api-app.io.pagopa.it/email_confirm.html"
    }

    # Using 100% sampling for production slot since the amount of traffic is
    # low and we want to have a good coverage of the logs
    prod_slot_sampling_percentage    = 100
    staging_slot_sampling_percentage = 100
  }
}

data "azurerm_resource_group" "function_public_rg" {
  name = "${local.project}-${local.domain}-${local.function_public.name}-rg-01"
}

module "function_public" {
  source  = "pagopa-dx/azure-function-app/azurerm"
  version = "~> 0.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_public.name
    instance_number = "02"
  }

  resource_group_name = data.azurerm_resource_group.function_public_rg.name
  health_check_path   = "/info"
  node_version        = 20
  app_service_plan_id = data.azurerm_service_plan.shared_plan_itn.id

  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id
  subnet_id     = azurerm_subnet.shared_plan_snet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings = merge(
    local.function_public.app_settings,
    {
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = local.function_public.prod_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = local.function_public.prod_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = local.function_public.prod_slot_sampling_percentage
    }
  )
  slot_app_settings = merge(
    local.function_public.app_settings,
    {
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage     = local.function_public.staging_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage     = local.function_public.staging_slot_sampling_percentage
      AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage = local.function_public.staging_slot_sampling_percentage
    }
  )

  sticky_app_setting_names = [
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__minSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__maxSamplingPercentage",
    "AzureFunctionsJobHost__logging__applicationInsights__samplingSettings__initialSamplingPercentage",
  ]

  subnet_service_endpoints = {
    web = true
  }

  application_insights_connection_string   = data.azurerm_application_insights.application_insights.connection_string
  application_insights_sampling_percentage = local.function_public.prod_slot_sampling_percentage

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}
