# ioweb_profile_api

<!-- BEGIN_TF_DOCS -->
## Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | 3.117.0 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_apim_itn_bff_api"></a> [apim\_itn\_bff\_api](#module\_apim\_itn\_bff\_api) | git::https://github.com/pagopa/terraform-azurerm-v3//api_management_api | v8.61.0 |

## Resources

| Name | Type |
|------|------|
| [azurerm_api_management_api_operation_policy.unlock_user_session_policy_itn](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_operation_policy) | resource |
| [azurerm_api_management_named_value.io_fn3_services_key_itn](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management.apim](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/api_management) | data source |
| [azurerm_key_vault.key_vault_common](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault_secret.io_fn3_services_key_secret](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_apim_name"></a> [apim\_name](#input\_apim\_name) | APIM Resource name | `string` | n/a | yes |
| <a name="input_apim_resource_group_name"></a> [apim\_resource\_group\_name](#input\_apim\_resource\_group\_name) | APIM Resource group name | `string` | n/a | yes |
| <a name="input_env_short"></a> [env\_short](#input\_env\_short) | n/a | `string` | n/a | yes |
| <a name="input_function_web_profile_basepath"></a> [function\_web\_profile\_basepath](#input\_function\_web\_profile\_basepath) | Base path of io-web-profile-backend | `string` | n/a | yes |
| <a name="input_function_web_profile_hostname"></a> [function\_web\_profile\_hostname](#input\_function\_web\_profile\_hostname) | Hostname of io-web-profile-backend | `string` | n/a | yes |
| <a name="input_prefix"></a> [prefix](#input\_prefix) | n/a | `string` | `"io"` | no |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
