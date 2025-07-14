
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

data "azurerm_resource_group" "auth_common_rg" {
  name = "${local.project}-${local.domain}-common-rg-01"
}

data "azurerm_application_insights" "application_insights" {
  name                = "${local.common_project}-ai-common"
  resource_group_name = "${local.common_project}-rg-common"
}

resource "azurerm_monitor_action_group" "error_action_group" {
  resource_group_name = data.azurerm_resource_group.auth_common_rg.name
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


resource "azurerm_monitor_scheduled_query_rules_alert_v2" "service-bus-logout-events-emission-failure" {
  enabled                 = true
  name                    = "[${upper(local.domain)}] ServiceBus Log-Out Event(s) emission failure(s)"
  resource_group_name     = data.azurerm_resource_group.main_resource_group.name
  scopes                  = [data.azurerm_application_insights.application_insights.id]
  description             = "Failure(s) detected on ServiceBus Authentication Event emission. See https://pagopa.atlassian.net/wiki/spaces/IAEI/pages/1859846279/Fallimento+emissione+evento+di+Log-Out"
  severity                = 1
  auto_mitigation_enabled = false
  location                = local.location

  // check once every 15 minutes(evaluation_frequency)
  // on the last 15 minutes of data(window_duration)
  evaluation_frequency = "PT15M"
  window_duration      = "PT15M"

  criteria {
    query                   = <<-QUERY
      customEvents
      | where name == "service-bus.auth-event.emission-failure"
      | extend eventData = parse_json(tostring(customDimensions.eventData))
      | where eventData.eventType == "logout""
    QUERY
    operator                = "GreaterThan"
    time_aggregation_method = "Count"
    threshold               = 0
    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.error_action_group.id]
  }

  tags = local.tags
}
