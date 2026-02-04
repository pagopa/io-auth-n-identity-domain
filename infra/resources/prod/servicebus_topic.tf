/////////////////////////
//      TOPICS         //
/////////////////////////
resource "azurerm_servicebus_topic" "io_auth_sessions_topic" {
  name         = "io-auth-sessions-topic"
  namespace_id = data.azurerm_servicebus_namespace.platform_service_bus_namespace.id
}

/////////////////////////
//    SUBSCRIPTIONS    //
/////////////////////////
resource "azurerm_servicebus_subscription" "io_session_notifications_sub" {
  name               = "io-session-notifications-sub"
  topic_id           = azurerm_servicebus_topic.io_auth_sessions_topic.id
  max_delivery_count = local.io_session_notifications_sub_max_delivery_count
  requires_session   = true
}

resource "azurerm_servicebus_subscription_rule" "session_events_filter" {
  name            = "io-auth-session-events-filter"
  subscription_id = azurerm_servicebus_subscription.io_session_notifications_sub.id

  filter_type = "SqlFilter"
  # this filter requires an "eventType" property on the topic message
  sql_filter = "eventType IN ('login','logout')"
}

resource "azurerm_servicebus_subscription" "io_auth_rejected_login_audit_logs_sub" {
  name               = "io-auth-rejected-login-audit-logs-sub"
  topic_id           = azurerm_servicebus_topic.io_auth_sessions_topic.id
  max_delivery_count = local.io_session_notifications_sub_max_delivery_count
  requires_session   = false
}

resource "azurerm_servicebus_subscription_rule" "rejected_login_audit_logs_filter" {
  name            = "io-auth-rejected-login-audit-logs-filter"
  subscription_id = azurerm_servicebus_subscription.io_auth_rejected_login_audit_logs_sub.id

  filter_type = "SqlFilter"
  # this filter requires an "eventType" property on the topic message
  sql_filter = "eventType = 'rejected_login'"
}

/////////////////////////
//         IAM         //
/////////////////////////

// Owner role to let the team manage the service bus topic on azure portal
module "topic_io_auth" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~>1.0"

  principal_id    = data.azuread_group.auth_admins.object_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  service_bus = [
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "owner"
      description         = "This role allows managing the given topic"
      topic_names         = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    },
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "owner"
      description         = "This role allows managing the given subscription"
      subscriptions = {
        io-auth-sessions-topic = [azurerm_servicebus_subscription.io_session_notifications_sub.name],
      }
    }
  ]
}

//Publishers

//NOTE: staging slot has been enabled on io-infra
module "pub_session_manager" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~>1.0"

  principal_id    = data.azurerm_linux_web_app.weu_session_manager.identity[0].principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  service_bus = [
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "writer"
      description         = "This role allows managing the given topic"
      topic_names         = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    }
  ]
}
//NOTE: staging slot has been enabled on io-infra
module "pub_session_manager_bis" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~>1.0"

  principal_id    = data.azurerm_linux_web_app.weu_session_manager_bis.identity[0].principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  service_bus = [
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "writer"
      description         = "This role allows managing the given topic"
      topic_names         = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    }
  ]
}

module "pub_session_manager_internal" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~>1.0"

  principal_id    = module.function_session_manager_internal.function_app.function_app.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  service_bus = [
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "writer"
      description         = "This role allows managing the given topic"
      topic_names         = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    },
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "reader"
      description         = "This role allows receiving messages from the subscription"
      topic_names         = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    }
  ]
}
module "pub_session_manager_internal_staging" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~>1.0"

  principal_id    = module.function_session_manager_internal.function_app.function_app.slot.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  service_bus = [
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "writer"
      description         = "This role allows managing the given topic"
      topic_names         = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    },
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "reader"
      description         = "This role allows receiving messages from the subscription"
      topic_names         = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    }
  ]
}

// Subscribers

module "sub_io_prof_async" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~>1.0"

  principal_id    = module.function_profile_async.function_app.function_app.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  service_bus = [
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "reader"
      description         = "This role allows receiving messages from the given subscription"
      subscriptions = {
        io-auth-sessions-topic = [azurerm_servicebus_subscription.io_session_notifications_sub.name],
      }
    }
  ]
}

module "sub_io_prof_async_staging" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~>1.0"

  principal_id    = module.function_profile_async.function_app.function_app.slot.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  service_bus = [
    {
      namespace_name      = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
      resource_group_name = data.azurerm_servicebus_namespace.platform_service_bus_namespace.resource_group_name
      role                = "reader"
      description         = "This role allows receiving messages from the given subscription"
      subscriptions = {
        io-auth-sessions-topic = [azurerm_servicebus_subscription.io_session_notifications_sub.name],
      }
    }
  ]
}


/////////////////////////
//       ALERTS        //
/////////////////////////
module "azure-service-bus-alerts" {
  source  = "pagopa-dx/azure-service-bus-alerts/azurerm"
  version = "~>0.1"

  service_bus_namespace_id = data.azurerm_servicebus_namespace.platform_service_bus_namespace.id

  alerts_on_active_messages = {
    description     = "Alert on active messages in the Service Bus topic for '${azurerm_servicebus_topic.io_auth_sessions_topic.name}'. See https://pagopa.atlassian.net/wiki/spaces/IAEI/pages/1853456776/Auth+Sessions+Topic+Active+Messages"
    entity_names    = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    threshold       = 5000
    check_every     = "PT5M"
    lookback_period = "PT5M"
    severity        = "Warning"
  }

  alerts_on_dlq_messages = {
    description     = "Alert on dead-lettered messages in the Service Bus topic for '${azurerm_servicebus_topic.io_auth_sessions_topic.name}'. See https://pagopa.atlassian.net/wiki/spaces/IAEI/pages/1852407824/Max+Retry+Reached+SessionNotificationEventsProcessor"
    entity_names    = [azurerm_servicebus_topic.io_auth_sessions_topic.name]
    threshold       = 0
    check_every     = "PT1H"
    lookback_period = "PT1H"
    severity        = "Error"
  }

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    app_name        = data.azurerm_servicebus_namespace.platform_service_bus_namespace.name
    instance_number = "01"
  }

  resource_group_name = data.azurerm_resource_group.main_resource_group.name
  action_group_ids    = [azurerm_monitor_action_group.error_action_group.id]
  tags                = local.tags
}
