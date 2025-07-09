# io_public_api

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
| <a name="module_api_v2_public"></a> [api\_v2\_public](#module\_api\_v2\_public) | github.com/pagopa/terraform-azurerm-v4//api_management_api | v7.16.0 |
| <a name="module_apim_v2_product_public"></a> [apim\_v2\_product\_public](#module\_apim\_v2\_product\_public) | github.com/pagopa/terraform-azurerm-v4//api_management_product | v7.16.0 |

## Resources

| Name | Type |
|------|------|
| [azurerm_api_management_named_value.io_fn3_public_key_v2](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management_named_value.io_fn3_public_url_v2](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_named_value) | resource |
| [azurerm_api_management.apim](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/api_management) | data source |
| [azurerm_key_vault_secret.io_fn3_public_key_secret_v2](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_api_host_name"></a> [api\_host\_name](#input\_api\_host\_name) | Host to use in Swagger files | `string` | n/a | yes |
| <a name="input_apim_name"></a> [apim\_name](#input\_apim\_name) | APIM Resource name | `string` | n/a | yes |
| <a name="input_apim_resource_group_name"></a> [apim\_resource\_group\_name](#input\_apim\_resource\_group\_name) | APIM Resource group name | `string` | n/a | yes |
| <a name="input_function_public_url"></a> [function\_public\_url](#input\_function\_public\_url) | URL of fn-public function where to redirect requests | `string` | n/a | yes |
| <a name="input_key_vault_common_id"></a> [key\_vault\_common\_id](#input\_key\_vault\_common\_id) | ID of the common key vault | `string` | n/a | yes |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
