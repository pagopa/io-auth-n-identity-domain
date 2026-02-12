# prod

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_azapi"></a> [azapi](#requirement\_azapi) | ~>2.4.0 |
| <a name="requirement_azurerm"></a> [azurerm](#requirement\_azurerm) | ~> 4.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azuread"></a> [azuread](#provider\_azuread) | 3.4.0 |
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | 4.35.0 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_azure-service-bus-alerts"></a> [azure-service-bus-alerts](#module\_azure-service-bus-alerts) | pagopa-dx/azure-service-bus-alerts/azurerm | ~>0.1 |
| <a name="module_common_values"></a> [common\_values](#module\_common\_values) | github.com/pagopa/io-infra//src/_modules/common_values | main |
| <a name="module_eventhub"></a> [eventhub](#module\_eventhub) | ../modules/eventhub | n/a |
| <a name="module_function_lollipop"></a> [function\_lollipop](#module\_function\_lollipop) | pagopa-dx/azure-function-app/azurerm | ~> 1.0 |
| <a name="module_function_lollipop_autoscale"></a> [function\_lollipop\_autoscale](#module\_function\_lollipop\_autoscale) | pagopa-dx/azure-app-service-plan-autoscaler/azurerm | ~> 2.0 |
| <a name="module_function_lv"></a> [function\_lv](#module\_function\_lv) | pagopa-dx/azure-function-app/azurerm | ~> 1.0 |
| <a name="module_function_lv_autoscale"></a> [function\_lv\_autoscale](#module\_function\_lv\_autoscale) | pagopa-dx/azure-app-service-plan-autoscaler/azurerm | ~> 2.0 |
| <a name="module_function_profile"></a> [function\_profile](#module\_function\_profile) | pagopa-dx/azure-function-app/azurerm | ~> 1.0 |
| <a name="module_function_profile_async"></a> [function\_profile\_async](#module\_function\_profile\_async) | pagopa-dx/azure-function-app/azurerm | ~> 1.0 |
| <a name="module_function_profile_async_autoscale"></a> [function\_profile\_async\_autoscale](#module\_function\_profile\_async\_autoscale) | pagopa-dx/azure-app-service-plan-autoscaler/azurerm | ~> 2.0 |
| <a name="module_function_profile_autoscale"></a> [function\_profile\_autoscale](#module\_function\_profile\_autoscale) | pagopa-dx/azure-app-service-plan-autoscaler/azurerm | ~> 2.0 |
| <a name="module_function_public"></a> [function\_public](#module\_function\_public) | pagopa-dx/azure-function-app/azurerm | ~> 1.0 |
| <a name="module_function_session_manager_internal"></a> [function\_session\_manager\_internal](#module\_function\_session\_manager\_internal) | pagopa-dx/azure-function-app/azurerm | ~> 1.0 |
| <a name="module_function_session_manager_internal_autoscale"></a> [function\_session\_manager\_internal\_autoscale](#module\_function\_session\_manager\_internal\_autoscale) | pagopa-dx/azure-app-service-plan-autoscaler/azurerm | ~> 2.0 |
| <a name="module_function_web_profile"></a> [function\_web\_profile](#module\_function\_web\_profile) | pagopa-dx/azure-function-app/azurerm | ~> 1.0 |
| <a name="module_iam_kv"></a> [iam\_kv](#module\_iam\_kv) | ../modules/iam | n/a |
| <a name="module_iam_kv_ioweb"></a> [iam\_kv\_ioweb](#module\_iam\_kv\_ioweb) | ../modules/iam | n/a |
| <a name="module_io_auth_internal_apim_api_itn"></a> [io\_auth\_internal\_apim\_api\_itn](#module\_io\_auth\_internal\_apim\_api\_itn) | ../modules/internal_api | n/a |
| <a name="module_io_platform_apim_api_itn"></a> [io\_platform\_apim\_api\_itn](#module\_io\_platform\_apim\_api\_itn) | ../modules/platform_proxy_api | n/a |
| <a name="module_io_profile_apim_api_itn"></a> [io\_profile\_apim\_api\_itn](#module\_io\_profile\_apim\_api\_itn) | ../modules/operation_api | n/a |
| <a name="module_io_public_apim_api_itn"></a> [io\_public\_apim\_api\_itn](#module\_io\_public\_apim\_api\_itn) | ../modules/io_public_api | n/a |
| <a name="module_key_vaults"></a> [key\_vaults](#module\_key\_vaults) | ../modules/key_vaults | n/a |
| <a name="module_pub_session_manager"></a> [pub\_session\_manager](#module\_pub\_session\_manager) | pagopa-dx/azure-role-assignments/azurerm | ~>1.0 |
| <a name="module_pub_session_manager_bis"></a> [pub\_session\_manager\_bis](#module\_pub\_session\_manager\_bis) | pagopa-dx/azure-role-assignments/azurerm | ~>1.0 |
| <a name="module_pub_session_manager_internal"></a> [pub\_session\_manager\_internal](#module\_pub\_session\_manager\_internal) | pagopa-dx/azure-role-assignments/azurerm | ~>1.0 |
| <a name="module_pub_session_manager_internal_staging"></a> [pub\_session\_manager\_internal\_staging](#module\_pub\_session\_manager\_internal\_staging) | pagopa-dx/azure-role-assignments/azurerm | ~>1.0 |
| <a name="module_redis_common_itn"></a> [redis\_common\_itn](#module\_redis\_common\_itn) | github.com/pagopa/terraform-azurerm-v4//redis_cache | v7.40.3 |
| <a name="module_storage_account_audit_services"></a> [storage\_account\_audit\_services](#module\_storage\_account\_audit\_services) | ../modules/storage_account_services | n/a |
| <a name="module_storage_account_maintenance_services"></a> [storage\_account\_maintenance\_services](#module\_storage\_account\_maintenance\_services) | ../modules/storage_account_services | n/a |
| <a name="module_storage_account_services"></a> [storage\_account\_services](#module\_storage\_account\_services) | ../modules/storage_account_services | n/a |
| <a name="module_storage_accounts"></a> [storage\_accounts](#module\_storage\_accounts) | ../modules/storage_accounts | n/a |
| <a name="module_sub_io_prof_async"></a> [sub\_io\_prof\_async](#module\_sub\_io\_prof\_async) | pagopa-dx/azure-role-assignments/azurerm | ~>1.0 |
| <a name="module_sub_io_prof_async_staging"></a> [sub\_io\_prof\_async\_staging](#module\_sub\_io\_prof\_async\_staging) | pagopa-dx/azure-role-assignments/azurerm | ~>1.0 |
| <a name="module_topic_io_auth"></a> [topic\_io\_auth](#module\_topic\_io\_auth) | pagopa-dx/azure-role-assignments/azurerm | ~>1.0 |
| <a name="module_webprofile_apim_api_itn"></a> [webprofile\_apim\_api\_itn](#module\_webprofile\_apim\_api\_itn) | ../modules/ioweb_profile_api | n/a |

## Resources

| Name | Type |
|------|------|
| [azurerm_key_vault_access_policy.func_profas](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_access_policy.func_profas_staging](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_access_policy.func_profile_kv_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_access_policy.func_profile_staging_kv_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_access_policy.kv_common_func_profas](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_access_policy.kv_common_func_profas_staging](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_key.ioweb_audit_logs_01](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_key) | resource |
| [azurerm_key_vault_secret.audit_st_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.citizen_auth_common_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.common_kv_session_st_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.cosmos_auth_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.cosmos_primary_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.iopstapp_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.iopstlogs_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.ioweb_kv_audit_st_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.lollipop_assertions_st_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.maintenance_st_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.redis_access_key_itn](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.session_st_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_monitor_action_group.error_action_group](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_action_group) | resource |
| [azurerm_monitor_autoscale_setting.shared_plan_autoscale](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_autoscale_setting) | resource |
| [azurerm_monitor_diagnostic_setting.io_storage_account_session_diagnostic_setting](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_diagnostic_setting) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.alert_service_preferences_migration_failed](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.alert_too_much_calls_on_unlock](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.alert_too_much_invalid_codes_on_unlock](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.expired-sessions-discoverer-bad-record-alert](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.expired-sessions-discoverer-max-retry-reached-alert](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.expired-sessions-discoverer-revert-failure-alert](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.expired_user_sessions_failure_alert_rule](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.pubkeys_revoke_failure_alert_rule](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.service-bus-logout-events-emission-failure](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.session-notification-events-processor-bad-message-alert](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.session-notification-events-processor-bad-record-alert](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.session-notification-events-processor-unable-to-build-new-record-alert](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_service_plan.shared_plan](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/service_plan) | resource |
| [azurerm_servicebus_subscription.io_auth_rejected_login_audit_logs_sub](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/servicebus_subscription) | resource |
| [azurerm_servicebus_subscription.io_session_notifications_sub](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/servicebus_subscription) | resource |
| [azurerm_servicebus_subscription_rule.rejected_login_audit_logs_filter](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/servicebus_subscription_rule) | resource |
| [azurerm_servicebus_subscription_rule.session_events_filter](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/servicebus_subscription_rule) | resource |
| [azurerm_servicebus_topic.io_auth_sessions_topic](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/servicebus_topic) | resource |
| [azurerm_storage_encryption_scope.ioweb_audit_logs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_encryption_scope) | resource |
| [azurerm_storage_encryption_scope.lollipop_assertions](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_encryption_scope) | resource |
| [azurerm_storage_encryption_scope.lvlogs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_encryption_scope) | resource |
| [azurerm_storage_encryption_scope.rejected_logins_logs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_encryption_scope) | resource |
| [azurerm_subnet.shared_plan_snet](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/subnet) | resource |
| [azuread_group.auth_admins](https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/data-sources/group) | data source |
| [azuread_group.auth_devs](https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/data-sources/group) | data source |
| [azurerm_api_management.platform_apim](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/api_management) | data source |
| [azurerm_application_gateway.app_gateway](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/application_gateway) | data source |
| [azurerm_application_insights.application_insights](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/application_insights) | data source |
| [azurerm_client_config.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/client_config) | data source |
| [azurerm_cosmosdb_account.cosmos_api](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/cosmosdb_account) | data source |
| [azurerm_cosmosdb_account.cosmos_citizen_auth](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/cosmosdb_account) | data source |
| [azurerm_key_vault.common_kv](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault.ioweb](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault.kv](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault_certificate_data.lollipop_certificate_v1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_certificate_data) | data source |
| [azurerm_key_vault_secret.alert_error_notification_email](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.alert_error_notification_opsgenie](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.alert_error_notification_slack](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.api_beta_testers](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.common_MAILUP_SECRET](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.common_MAILUP_USERNAME](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.cosmos_api_connection_string](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.exchange_jwt_private_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.exchange_jwt_pub_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.fast_login_session_manager_internal_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.fast_login_subscription_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.first_lollipop_consumer_subscription_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.fn_app_PUBLIC_API_KEY](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.fn_app_SPID_LOGS_PUBLIC_KEY](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.function_profile_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.functions_app_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.functions_fast_login_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.immutable_spid_logs_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.io_com_mailup_secret](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.io_com_mailup_username](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.ioweb_profile_function_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.magic_link_jwe_private_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.magic_link_jwe_pub_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.profile_async_session_manager_internal_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.spid_login_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.spid_login_jwt_pub_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_linux_web_app.weu_session_manager](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/linux_web_app) | data source |
| [azurerm_linux_web_app.weu_session_manager_bis](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/linux_web_app) | data source |
| [azurerm_private_dns_zone.privatelink_redis_cache](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/private_dns_zone) | data source |
| [azurerm_redis_cache.redis_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/redis_cache) | data source |
| [azurerm_resource_group.audit](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.auth_common_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.core_domain_data_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.core_domain_redis_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.function_lollipop_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.function_lv_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.function_public_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.function_web_profile_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.ioweb_storage_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.itn_auth_01](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.main_resource_group](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.rg_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.rg_elt](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.shared_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_service_plan.shared_plan_itn](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/service_plan) | data source |
| [azurerm_servicebus_namespace.platform_service_bus_namespace](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/servicebus_namespace) | data source |
| [azurerm_storage_account.citizen_auth_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.immutable_lv_audit_logs_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.immutable_spid_logs_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.lollipop_assertion_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.push_notifications_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.storage_api](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.storage_apievents](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.storage_app](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.storage_logs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_subnet.private_endpoints_subnet](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/subnet) | data source |
| [azurerm_subnet.weu_private_endpoints_subnet](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/subnet) | data source |
| [azurerm_subscription.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/subscription) | data source |
| [azurerm_virtual_network.itn_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/virtual_network) | data source |
| [azurerm_virtual_network.weu_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/virtual_network) | data source |

## Inputs

No inputs.

## Outputs

No outputs.
<!-- END_TF_DOCS -->
