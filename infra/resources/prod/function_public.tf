

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
      PROFILE_EMAIL_STORAGE_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.session_st_connection_string.versionless_id})"
      PROFILE_EMAIL_STORAGE_TABLE_NAME        = local.profile_emails_table_name

      COSMOSDB_URI  = data.azurerm_cosmosdb_account.cosmos_api.endpoint
      COSMOSDB_KEY  = data.azurerm_cosmosdb_account.cosmos_api.primary_key
      COSMOSDB_NAME = "db"

      MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.maintenance_st_connection_string.versionless_id})"
      VALIDATION_TOKENS_TABLE_NAME                  = local.validation_tokens_table_name
    }

    # Using 100% sampling for production slot since the amount of traffic is
    # low and we want to have a good coverage of the logs
    prod_slot_sampling_percentage = 100
  }
}

data "azurerm_resource_group" "function_public_rg" {
  name = "${local.project}-${local.domain}-${local.function_public.name}-rg-01"
}

module "function_public" {
  source  = "pagopa-dx/azure-function-app/azurerm"
  version = "~> 1.0"

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
  node_version        = 22
  app_service_plan_id = data.azurerm_service_plan.shared_plan_itn.id

  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id
  subnet_id     = azurerm_subnet.shared_plan_snet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings      = local.function_public.app_settings
  slot_app_settings = local.function_public.app_settings

  subnet_service_endpoints = {
    web = true
  }

  application_insights_connection_string   = data.azurerm_application_insights.application_insights.connection_string
  application_insights_sampling_percentage = local.function_public.prod_slot_sampling_percentage

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}
