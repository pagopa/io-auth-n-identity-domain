# operation_api

<!-- BEGIN_TF_DOCS -->
## Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | n/a |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_api_v2_profile_operation"></a> [api\_v2\_profile\_operation](#module\_api\_v2\_profile\_operation) | github.com/pagopa/terraform-azurerm-v4//api_management_api | v7.40.3 |
| <a name="module_apim_v2_product_auth-n-identity_operation"></a> [apim\_v2\_product\_auth-n-identity\_operation](#module\_apim\_v2\_product\_auth-n-identity\_operation) | github.com/pagopa/terraform-azurerm-v4//api_management_product | v7.40.3 |

## Resources

| Name | Type |
|------|------|
| [azurerm_api_management_api_operation_policy.get_profile_operation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_operation_policy) | resource |
| [azurerm_api_management_api_operation_policy.get_profile_service_preferences_operation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_operation_policy) | resource |
| [azurerm_api_management_api_operation_policy.get_profile_versions_operation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_operation_policy) | resource |
| [azurerm_api_management_api_operation_policy.sanitize_profile_email_operation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_operation_policy) | resource |
| [azurerm_api_management_group.api_profile_operation_read](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_group) | resource |
| [azurerm_api_management_group.api_profile_operation_write](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_group) | resource |
| [azurerm_api_management_group_user.auth_n_identity_operation_group](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_group_user) | resource |
| [azurerm_api_management_group_user.auth_n_identity_profile_operation_write_group](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_group_user) | resource |
| [azurerm_api_management_named_value.api_profile_operation_read_group_name](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management_named_value.api_profile_operation_write_group_name](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management_named_value.io_fn_admin_master_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management_named_value.io_fn_admin_trigger_url](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management_named_value.io_fn_profile_key](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management_subscription.auth_n_identity_operation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_subscription) | resource |
| [azurerm_api_management.apim](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/api_management) | data source |
| [azurerm_api_management_user.auth_n_identity_operation_user](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/api_management_user) | data source |
| [azurerm_key_vault_secret.io_fn_admin_master_key_secret](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_key_vault_secret.io_fn_profile_key_secret](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_api_host_name"></a> [api\_host\_name](#input\_api\_host\_name) | Host to use in Swagger files | `string` | n/a | yes |
| <a name="input_apim_name"></a> [apim\_name](#input\_apim\_name) | APIM Resource name | `string` | n/a | yes |
| <a name="input_apim_resource_group_name"></a> [apim\_resource\_group\_name](#input\_apim\_resource\_group\_name) | APIM Resource group name | `string` | n/a | yes |
| <a name="input_function_admin_url"></a> [function\_admin\_url](#input\_function\_admin\_url) | Function Admin URL | `string` | n/a | yes |
| <a name="input_function_profile_url"></a> [function\_profile\_url](#input\_function\_profile\_url) | Function Profile URL | `string` | n/a | yes |
| <a name="input_key_vault_common_id"></a> [key\_vault\_common\_id](#input\_key\_vault\_common\_id) | ID of the common key vault | `string` | n/a | yes |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
