module "sm_ca" {
  source  = "pagopa-dx/azure-container-app/azurerm"
  version = "~> 6.0"

  environment = {
    prefix          = var.prefix
    env_short       = var.env_short
    location        = var.location
    domain          = var.domain
    app_name        = local.app_name
    instance_number = "01"
  }

  container_app_environment_id = module.sm_cae.id

  log_analytics_workspace_id = var.log_analytics_workspace_id

  secrets = [
    {
      name                = "ONEID_PROD_CLIENT_SECRET"
      key_vault_secret_id = azurerm_key_vault_secret.sm_oneid_prod_client_secret.versionless_id
    },
    {
      name                = "ONEID_UAT_CLIENT_SECRET"
      key_vault_secret_id = azurerm_key_vault_secret.sm_oneid_uat_client_secret.versionless_id
    },
    {
      name                = "LOLLIPOP_API_KEY"
      key_vault_secret_id = azurerm_key_vault_secret.sm_lollipop_api_key.versionless_id
    },
    {
      name                = "IO_PROFILE_API_KEY"
      key_vault_secret_id = azurerm_key_vault_secret.sm_io_profile_api_key.versionless_id
    },
  ]

  containers = [
    {
      image = "ghcr.io/pagopa/io-auth-sm"
      name  = "${var.prefix}-${var.domain}-${local.app_name}"

      app_settings = local.app_settings
      secret_names = ["ONEID_PROD_CLIENT_SECRET", "ONEID_UAT_CLIENT_SECRET", "LOLLIPOP_API_KEY", "IO_PROFILE_API_KEY"]

      liveness_probe = {
        path = "/api/auth/v2/health/liveness"
      }
      readiness_probe = {
        path = "/api/auth/v2/health/readiness"
      }
    },
  ]

  autoscaler = {
    replicas = {
      minimum = 1
      maximum = 8
    }
  }

  container_port = local.listen_port

  resource_group_name = var.resource_group_name

  tags = var.tags
}
