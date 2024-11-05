data "azurerm_key_vault_secret" "fast_login_subscription_key" {
  name         = "fast-login-subscription-key-v2"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_secret" "backendli_api_key" {
  name         = "appbackend-PRE-SHARED-KEY"
  key_vault_id = data.azurerm_key_vault.kv_common.id
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
    domain          = "auth"
    app_name        = local.function_lv.name
    instance_number = "02"
  }

  resource_group_name = azurerm_resource_group.function_lv_rg.name
  health_check_path   = "/info"
  node_version        = 20
  tier                = "xl"

  subnet_cidr                          = local.cidr_subnet_fnfastlogin
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

  tags = local.tags
}
