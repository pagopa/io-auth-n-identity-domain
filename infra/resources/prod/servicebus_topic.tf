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
        io-auth-topic = [azurerm_servicebus_subscription.io_session_notifications_sub.name],
      }
    }
  ]
}

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
        io-auth-topic = [azurerm_servicebus_subscription.io_session_notifications_sub.name],
      }
    }
  ]
}
