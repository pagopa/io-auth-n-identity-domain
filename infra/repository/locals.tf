locals {
  project         = "io-p"
  location_short  = "itn"
  location_legacy = "weu"

  identity_resource_group_name = "${local.project}-identity-rg"

  repo_secrets = {
    "ARM_TENANT_ID"       = data.azurerm_client_config.current.tenant_id,
    "ARM_SUBSCRIPTION_ID" = data.azurerm_subscription.current.subscription_id
  }

  ci = {
    secrets = {
      "ARM_CLIENT_ID" = data.azurerm_user_assigned_identity.identity_prod_ci.client_id
    }
  }

  # -------------------------
  # Session Manager Data
  # -------------------------
  session_manager_name                = "${local.project}-${local.location_legacy}-session-manager-app-02"
  session_manager_resource_group_name = "${local.project}-${local.location_short}-session-manager-rg-01"

  session_manager_cd = {
    secrets = {
      "ARM_CLIENT_ID" = data.azurerm_user_assigned_identity.identity_session_manager_prod_cd.client_id,
    },
    variables = {
      "AZURE_WEB_APP_RESOURCE_GROUP" = local.session_manager_resource_group_name,
      "AZURE_WEB_APP_NAME"           = local.session_manager_name,
      "HEALTH_CHECK_PATH"            = coalesce(data.azurerm_linux_web_app.session_manager.site_config[0].health_check_path, "/")
    }
  }
}
