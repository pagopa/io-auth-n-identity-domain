###
### SECRETS
###
data "azurerm_key_vault_secret" "api_beta_testers" {
  name         = "ioweb-profile-api-beta-testers"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "functions_fast_login_api_key" {
  name         = "ioweb-profile-functions-fast-login-api-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "immutable_spid_logs_storage" {
  name         = "spid-logs-st-connection-string"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "functions_app_api_key" {
  name         = "ioweb-profile-functions-app-api-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "spid_login_jwt_pub_key" {
  name         = "spid-login-jwt-pub-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "spid_login_api_key" {
  name         = "ioweb-profile-spid-login-api-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "exchange_jwt_pub_key" {
  name         = "ioweb-profile-exchange-jwt-pub-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "exchange_jwt_private_key" {
  name         = "ioweb-profile-exchange-jwt-private-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "magic_link_jwe_pub_key" {
  name         = "ioweb-profile-magic-link-jwe-pub-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}

data "azurerm_key_vault_secret" "magic_link_jwe_private_key" {
  name         = "ioweb-profile-magic-link-jwe-private-key"
  key_vault_id = data.azurerm_key_vault.ioweb.id
}
###

locals {
  function_JWT_issuer = "api-web.io.pagopa.it/ioweb/backend"
  function_ioweb_profile = {
    name = "webprof"
    app_settings = {
      NODE_ENV = "production"

      // Keepalive fields are all optionals
      FETCH_KEEPALIVE_ENABLED             = "true"
      FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL   = "110000"
      FETCH_KEEPALIVE_MAX_SOCKETS         = "40"
      FETCH_KEEPALIVE_MAX_FREE_SOCKETS    = "10"
      FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT = "30000"
      FETCH_KEEPALIVE_TIMEOUT             = "60000"

      // --------------
      // FF AND TESTERS
      // --------------
      FF_API_ENABLED = "ALL"
      BETA_TESTERS   = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.api_beta_testers.versionless_id})"

      // ------------
      // JWT Config
      // ------------
      BEARER_AUTH_HEADER               = "authorization"
      EXCHANGE_JWT_ISSUER              = local.function_JWT_issuer
      EXCHANGE_JWT_PRIMARY_PUB_KEY     = trimspace(data.azurerm_key_vault_secret.exchange_jwt_pub_key.value)
      EXCHANGE_JWT_PRIMARY_PRIVATE_KEY = trimspace(data.azurerm_key_vault_secret.exchange_jwt_private_key.value)
      // 1 hour
      EXCHANGE_JWT_TTL                   = "3600"
      MAGIC_LINK_JWE_PRIMARY_PRIVATE_KEY = trimspace(data.azurerm_key_vault_secret.magic_link_jwe_private_key.value)
      MAGIC_LINK_JWE_PRIMARY_PUB_KEY     = trimspace(data.azurerm_key_vault_secret.magic_link_jwe_pub_key.value)
      MAGIC_LINK_JWE_ISSUER              = local.function_JWT_issuer
      MAGIC_LINK_BASE_URL                = "https://account.ioapp.it/it/blocco-accesso/magic-link/"
      // TBD: more/less than 1 week?
      MAGIC_LINK_JWE_TTL = "604800"

      HUB_SPID_LOGIN_JWT_ISSUER  = "api-web.io.pagopa.it/ioweb/auth"
      HUB_SPID_LOGIN_JWT_PUB_KEY = trimspace(data.azurerm_key_vault_secret.spid_login_jwt_pub_key.value)

      // -------------------------
      // Fast Login config
      // -------------------------
      FAST_LOGIN_API_KEY         = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.functions_fast_login_api_key.versionless_id})"
      FAST_LOGIN_CLIENT_BASE_URL = "https://io-p-itn-auth-lv-func-02.azurewebsites.net"

      // -------------------------
      // Functions App config
      // -------------------------
      FUNCTIONS_APP_API_KEY         = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.functions_app_api_key.versionless_id})"
      FUNCTIONS_APP_CLIENT_BASE_URL = "https://io-p-itn-auth-profile-func-02.azurewebsites.net"

      // -------------------------
      // Hub Spid Login for ioweb config
      // -------------------------
      HUB_SPID_LOGIN_API_KEY         = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.spid_login_api_key.versionless_id})"
      HUB_SPID_LOGIN_CLIENT_BASE_URL = "https://io-p-weu-ioweb-spid-login.azurewebsites.net"

      // -------------------------
      // Audit Logs config
      // -------------------------
      AUDIT_LOG_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.immutable_spid_logs_storage.versionless_id})"
      AUDIT_LOG_CONTAINER         = "auditlogs"
    }
    prod_slot_sampling_percentage = 5
  }
}

data "azurerm_resource_group" "function_web_profile_rg" {
  name = "${local.project}-${local.domain}-${local.function_ioweb_profile.name}-rg-01"
}

module "function_web_profile" {
  source  = "pagopa-dx/azure-function-app/azurerm"
  version = "~> 1.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = local.function_ioweb_profile.name
    instance_number = "01"
  }

  resource_group_name = data.azurerm_resource_group.function_web_profile_rg.name
  health_check_path   = "/api/v1/info"
  node_version        = 20
  app_service_plan_id = data.azurerm_service_plan.shared_plan_itn.id

  subnet_cidr   = local.cidr_subnet_fn_web_profile
  subnet_pep_id = data.azurerm_subnet.private_endpoints_subnet.id

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  virtual_network = {
    name                = data.azurerm_virtual_network.itn_common.name
    resource_group_name = data.azurerm_virtual_network.itn_common.resource_group_name
  }

  app_settings      = local.function_ioweb_profile.app_settings
  slot_app_settings = local.function_ioweb_profile.app_settings

  subnet_service_endpoints = {
    web = true
  }

  application_insights_connection_string   = data.azurerm_application_insights.application_insights.connection_string
  application_insights_sampling_percentage = local.function_ioweb_profile.prod_slot_sampling_percentage

  action_group_id = azurerm_monitor_action_group.error_action_group.id

  tags = local.tags
}

// ----------------------------------------------------
// Alerts
// ----------------------------------------------------
resource "azurerm_monitor_scheduled_query_rules_alert_v2" "alert_too_much_invalid_codes_on_unlock" {
  enabled                 = true
  name                    = "[${upper(local.domain)} | ${module.function_web_profile.function_app.function_app.name}] Unexpected number of invalid codes to unlock endpoint"
  resource_group_name     = data.azurerm_resource_group.function_web_profile_rg.name
  scopes                  = [data.azurerm_application_gateway.app_gateway.id]
  description             = "Too many invalid codes submitted to IO-WEB profile unlock functionality"
  severity                = 1
  auto_mitigation_enabled = false
  location                = data.azurerm_resource_group.function_web_profile_rg.location

  // check once every minute(evaluation_frequency)
  // on the last minute of data(window_duration)
  evaluation_frequency = "PT1M"
  window_duration      = "PT1M"

  criteria {
    query                   = <<-QUERY
AzureDiagnostics
| where requestUri_s == "/ioweb/backend/api/v1/unlock-session" and httpMethod_s == "POST"
| where serverStatus_s == 403
    QUERY
    operator                = "GreaterThanOrEqual"
    time_aggregation_method = "Count"
    threshold               = 5
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

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "alert_too_much_calls_on_unlock" {
  enabled                 = true
  name                    = "[${upper(local.domain)} | ${module.function_web_profile.function_app.function_app.name}] Unexpected number of calls to unlock endpoint"
  resource_group_name     = data.azurerm_resource_group.function_web_profile_rg.name
  scopes                  = [data.azurerm_application_gateway.app_gateway.id]
  description             = "Too many calls submitted to IO-WEB profile unlock functionality"
  severity                = 1
  auto_mitigation_enabled = false
  location                = data.azurerm_resource_group.function_web_profile_rg.location

  // check once every minute(evaluation_frequency)
  // on the last minute of data(window_duration)
  evaluation_frequency = "PT1M"
  window_duration      = "PT1M"

  criteria {
    query                   = <<-QUERY
AzureDiagnostics
| where requestUri_s == "/ioweb/backend/api/v1/unlock-session" and httpMethod_s == "POST"
| where serverStatus_s == 429
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
