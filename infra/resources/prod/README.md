# prod

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_azurerm"></a> [azurerm](#requirement\_azurerm) | <= 3.116.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | 3.116.0 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_common_values"></a> [common\_values](#module\_common\_values) | github.com/pagopa/io-infra//src/_modules/common_values | main |
| <a name="module_eventhub"></a> [eventhub](#module\_eventhub) | ../../modules/eventhub | n/a |
| <a name="module_function_lollipop"></a> [function\_lollipop](#module\_function\_lollipop) | pagopa/dx-azure-function-app/azurerm | ~> 0 |
| <a name="module_function_lollipop_autoscale"></a> [function\_lollipop\_autoscale](#module\_function\_lollipop\_autoscale) | pagopa/dx-azure-app-service-plan-autoscaler/azurerm | 0.0.2 |
| <a name="module_function_lv"></a> [function\_lv](#module\_function\_lv) | pagopa/dx-azure-function-app/azurerm | ~> 0 |
| <a name="module_function_lv_autoscale"></a> [function\_lv\_autoscale](#module\_function\_lv\_autoscale) | pagopa/dx-azure-app-service-plan-autoscaler/azurerm | 0.0.2 |
| <a name="module_function_profile_async"></a> [function\_profile\_async](#module\_function\_profile\_async) | pagopa/dx-azure-function-app/azurerm | ~> 0 |
| <a name="module_function_profile_async_autoscale"></a> [function\_profile\_async\_autoscale](#module\_function\_profile\_async\_autoscale) | pagopa/dx-azure-app-service-plan-autoscaler/azurerm | 0.0.2 |
| <a name="module_function_public"></a> [function\_public](#module\_function\_public) | pagopa/dx-azure-function-app/azurerm | ~> 0 |
| <a name="module_function_web_profile"></a> [function\_web\_profile](#module\_function\_web\_profile) | pagopa/dx-azure-function-app/azurerm | ~> 0 |
| <a name="module_io_profile_apim_api_itn"></a> [io\_profile\_apim\_api\_itn](#module\_io\_profile\_apim\_api\_itn) | ../../modules/operation_api | n/a |
| <a name="module_io_profile_apim_api_weu"></a> [io\_profile\_apim\_api\_weu](#module\_io\_profile\_apim\_api\_weu) | ../../modules/operation_api | n/a |
| <a name="module_io_public_apim_api_itn"></a> [io\_public\_apim\_api\_itn](#module\_io\_public\_apim\_api\_itn) | ../../modules/io_public_api | n/a |
| <a name="module_io_public_apim_api_weu"></a> [io\_public\_apim\_api\_weu](#module\_io\_public\_apim\_api\_weu) | ../../modules/io_public_api | n/a |
| <a name="module_webprofile_apim_api_itn"></a> [webprofile\_apim\_api\_itn](#module\_webprofile\_apim\_api\_itn) | ../../modules/ioweb_profile_api | n/a |
| <a name="module_webprofile_apim_api_weu"></a> [webprofile\_apim\_api\_weu](#module\_webprofile\_apim\_api\_weu) | ../../modules/ioweb_profile_api | n/a |

## Resources

| Name | Type |
|------|------|
| [azurerm_app_service_plan.shared_plan](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/app_service_plan) | resource |
| [azurerm_monitor_action_group.error_action_group](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_action_group) | resource |
| [azurerm_monitor_autoscale_setting.shared_plan_autoscale](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_autoscale_setting) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.alert_service_preferences_migration_failed](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.alert_too_much_calls_on_unlock](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_monitor_scheduled_query_rules_alert_v2.alert_too_much_invalid_codes_on_unlock](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/monitor_scheduled_query_rules_alert_v2) | resource |
| [azurerm_resource_group.auth_common_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_resource_group.function_lollipop_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_resource_group.function_lv_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_resource_group.function_public_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_resource_group.function_web_profile_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_resource_group.main_resource_group](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_resource_group.rg_elt](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_resource_group.shared_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_subnet.shared_plan_snet](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/subnet) | resource |
| [azurerm_app_service.app_backend_li](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/app_service) | data source |
| [azurerm_app_service_plan.shared_plan_itn](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/app_service_plan) | data source |
| [azurerm_application_gateway.app_gateway](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/application_gateway) | data source |
| [azurerm_application_insights.application_insights](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/application_insights) | data source |
| [azurerm_cosmosdb_account.cosmos_api](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/cosmosdb_account) | data source |
| [azurerm_cosmosdb_account.cosmos_citizen_auth](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/cosmosdb_account) | data source |
| [azurerm_key_vault.common_kv](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault.ioweb_kv](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault.kv](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault_certificate_data.lollipop_certificate_v1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_certificate_data) | data source |
| [azurerm_key_vault_secret.alert_error_notification_email](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.alert_error_notification_opsgenie](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.alert_error_notification_slack](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.api_beta_testers](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.backendli_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.exchange_jwt_private_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.exchange_jwt_pub_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.fast_login_subscription_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.first_lollipop_consumer_subscription_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.function_profile_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.functions_app_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.functions_fast_login_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.low_priority_mailup_secret](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.low_priority_mailup_username](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.magic_link_jwe_private_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.magic_link_jwe_pub_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.spid_login_api_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.spid_login_jwt_pub_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_redis_cache.core_domain_redis_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/redis_cache) | data source |
| [azurerm_resource_group.core_domain_data_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.core_domain_redis_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.ioweb_storage_rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_resource_group.rg_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/resource_group) | data source |
| [azurerm_storage_account.citizen_auth_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.immutable_lv_audit_logs_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.immutable_spid_logs_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.lollipop_assertion_storage](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.storage_api](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_storage_account.storage_app](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |
| [azurerm_subnet.private_endpoints_subnet](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/subnet) | data source |
| [azurerm_virtual_network.itn_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/virtual_network) | data source |

## Inputs

No inputs.

## Outputs

No outputs.
<!-- END_TF_DOCS -->
