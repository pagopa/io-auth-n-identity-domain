
data "azurerm_key_vault_secret" "alert_error_notification_email" {
  name         = "alert-error-notification-email"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_secret" "alert_error_notification_slack" {
  name         = "alert-error-notification-slack"
  key_vault_id = data.azurerm_key_vault.kv.id
}

data "azurerm_key_vault_secret" "alert_error_notification_opsgenie" {
  name         = "alert-error-notification-opsgenie"
  key_vault_id = data.azurerm_key_vault.kv.id
}

resource "azurerm_resource_group" "auth_common_rg" {
  name     = "${local.project}-${local.domain}-common-rg-01"
  location = local.location

  tags = local.tags
}

data "azurerm_application_insights" "application_insights" {
  name                = "${local.common_project}-ai-common"
  resource_group_name = "${local.common_project}-rg-common"
}

resource "azurerm_monitor_action_group" "error_action_group" {
  resource_group_name = azurerm_resource_group.auth_common_rg.name
  name                = "${local.project}-${local.domain}-error-ag-01"
  short_name          = "${local.domain}-error"

  #TODO: use domain email
  email_receiver {
    name                    = "email"
    email_address           = data.azurerm_key_vault_secret.alert_error_notification_email.value
    use_common_alert_schema = true
  }

  email_receiver {
    name                    = "slack"
    email_address           = data.azurerm_key_vault_secret.alert_error_notification_slack.value
    use_common_alert_schema = true
  }

  webhook_receiver {
    name                    = "sendtoopsgenie"
    service_uri             = data.azurerm_key_vault_secret.alert_error_notification_opsgenie.value
    use_common_alert_schema = true
  }

  tags = local.tags
}
