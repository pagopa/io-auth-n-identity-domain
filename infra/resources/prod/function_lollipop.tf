data "azurerm_key_vault_secret" "first_lollipop_consumer_subscription_key" {
  name         = "first-lollipop-consumer-pagopa-subscription-key"
  key_vault_id = module.key_vaults.auth.id
}

data "azurerm_key_vault_certificate_data" "lollipop_certificate_v1" {
  name         = "lollipop-certificate-v1"
  key_vault_id = module.key_vaults.auth.id
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
      COSMOSDB_KEY                 = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.cosmos_primary_key.versionless_id})"
      COSMOS_API_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.cosmos_auth_connection_string.versionless_id})"

      #TODO: remove in favor of the new storage on itn with connection string 'SESSION_STORAGE_CONNECTION_STRING' when no longer needed
      LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING          = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.session_st_connection_string.versionless_id})"
      LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME             = local.lollipop_assertions_container_name
      LOLLIPOP_ASSERTION_STORAGE_FALLBACK_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.lollipop_assertions_st_connection_string.versionless_id})"
      LOLLIPOP_ASSERTION_STORAGE_FALLBACK_CONTAINER_NAME    = "assertions"
      SESSION_STORAGE_CONNECTION_STRING                     = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.session_st_connection_string.versionless_id})"
      LOLLIPOP_ASSERTION_REVOKE_QUEUE                       = local.pubkeys_revoke_queue_name

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
      FIRST_LC_ASSERTION_CLIENT_SUBSCRIPTION_KEY = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.first_lollipop_consumer_subscription_key.versionless_id})"
    }

    prod_slot_sampling_percentage = 5
  }
}

data "azurerm_resource_group" "function_lollipop_rg" {
  name = "${local.project}-${local.domain}-${local.function_lollipop.name}-rg-02"
}

module "function_lollipop" {
  source  = "pagopa-dx/azure-function-app/azurerm"
  version = "~> 1.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_lollipop.name
    instance_number = "02"
  }

  resource_group_name = data.azurerm_resource_group.function_lollipop_rg.name
  health_check_path   = "/info"
  node_version        = 20
  # P3mv3 SKU and 10 Worker process count
  tier = "xxl"

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
      "AzureWebJobs.HandlePubKeyRevoke.Disabled" = "0"
    },
  )
  slot_app_settings = merge(
    local.function_lollipop.app_settings,
    {
      "AzureWebJobs.HandlePubKeyRevoke.Disabled" = "1"
    },
  )

  sticky_app_setting_names = [
    "AzureWebJobs.HandlePubKeyRevoke.Disabled",
  ]

  application_insights_connection_string   = data.azurerm_application_insights.application_insights.connection_string
  application_insights_sampling_percentage = local.function_lollipop.prod_slot_sampling_percentage

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

module "function_lollipop_autoscale" {
  source  = "pagopa-dx/azure-app-service-plan-autoscaler/azurerm"
  version = "~> 2.0"

  resource_group_name = data.azurerm_resource_group.function_lollipop_rg.name
  location            = local.location
  app_service_plan_id = module.function_lollipop.function_app.plan.id
  target_service = {
    function_apps = [
      {
        name = module.function_lollipop.function_app.function_app.name
      }
    ]
  }

  scheduler = {
    normal_load = {
      minimum = 8
      default = 8
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


resource "azurerm_monitor_scheduled_query_rules_alert_v2" "pubkeys_revoke_failure_alert_rule" {
  enabled             = true
  name                = "[CITIZEN-AUTH | ${module.storage_accounts.session.name}] Failures on ${local.pubkeys_revoke_poison_queue_name} queue"
  resource_group_name = data.azurerm_resource_group.main_resource_group.name
  location            = local.location

  scopes                  = [module.storage_accounts.session.id]
  description             = <<-EOT
    Permanent failures processing ${local.pubkeys_revoke_queue_name} queue. REQUIRED MANUAL ACTION.
  EOT
  severity                = 1
  auto_mitigation_enabled = false

  // daily check
  window_duration      = "P1D"
  evaluation_frequency = "P1D"

  criteria {
    query                   = <<-QUERY
      StorageQueueLogs
        | where OperationName contains "PutMessage"
        | where Uri contains "${local.pubkeys_revoke_poison_queue_name}"
      QUERY
    operator                = "GreaterThan"
    threshold               = 0
    time_aggregation_method = "Count"
  }

  action {
    action_groups = [azurerm_monitor_action_group.error_action_group.id]
  }

  tags = local.tags
}
