# external_api

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
| <a name="module_api_v2_profile_internal"></a> [api\_v2\_profile\_internal](#module\_api\_v2\_profile\_internal) | github.com/pagopa/terraform-azurerm-v3//api_management_api | v8.27.0 |
| <a name="module_apim_v2_product_auth-n-identity_internal"></a> [apim\_v2\_product\_auth-n-identity\_internal](#module\_apim\_v2\_product\_auth-n-identity\_internal) | github.com/pagopa/terraform-azurerm-v3//api_management_product | v8.27.0 |

## Resources

| Name | Type |
|------|------|
| [azurerm_api_management_api_operation_policy.get_profile_internal](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_operation_policy) | resource |
| [azurerm_api_management_group.api_profile_internal_read](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_group) | resource |
| [azurerm_api_management_group_user.auth_n_identity_internal_group](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_group_user) | resource |
| [azurerm_api_management_named_value.api_profile_internal_read_group_name](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management_subscription.auth_n_identity_internal](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_subscription) | resource |
| [azurerm_api_management_user.auth_n_identity_wallet_internal_user](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_user) | resource |
| [azurerm_api_management.apim](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/api_management) | data source |
| [azurerm_key_vault_secret.io_fn_profile_key_secret](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_api_host_name"></a> [api\_host\_name](#input\_api\_host\_name) | Host to use in Swagger files | `string` | n/a | yes |
| <a name="input_apim_name"></a> [apim\_name](#input\_apim\_name) | APIM Resource name | `string` | n/a | yes |
| <a name="input_apim_resource_group_name"></a> [apim\_resource\_group\_name](#input\_apim\_resource\_group\_name) | APIM Resource group name | `string` | n/a | yes |
| <a name="input_function_profile_url"></a> [function\_profile\_url](#input\_function\_profile\_url) | Function Profile URL | `string` | n/a | yes |
| <a name="input_key_vault_common_id"></a> [key\_vault\_common\_id](#input\_key\_vault\_common\_id) | ID of the common key vault | `string` | n/a | yes |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
