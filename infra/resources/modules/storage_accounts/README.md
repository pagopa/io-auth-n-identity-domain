# storage_accounts

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
| <a name="module_st_audit_01"></a> [st\_audit\_01](#module\_st\_audit\_01) | pagopa-dx/azure-storage-account/azurerm | ~> 1.0 |
| <a name="module_st_maintenance_01"></a> [st\_maintenance\_01](#module\_st\_maintenance\_01) | pagopa-dx/azure-storage-account/azurerm | ~> 1.0 |
| <a name="module_st_session_01"></a> [st\_session\_01](#module\_st\_session\_01) | pagopa-dx/azure-storage-account/azurerm | ~> 1.0 |

## Resources

| Name | Type |
|------|------|
| [azurerm_management_lock.st_audit_01](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/management_lock) | resource |
| [azurerm_management_lock.st_maintenance_01](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/management_lock) | resource |
| [azurerm_management_lock.st_session_01](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/management_lock) | resource |
| [azurerm_storage_management_policy.delete_after_2yrs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_management_policy) | resource |
| [azurerm_storage_management_policy.lollipop_assertions_01_delete_after_2yrs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_management_policy) | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_audit_resource_group_name"></a> [audit\_resource\_group\_name](#input\_audit\_resource\_group\_name) | n/a | `string` | n/a | yes |
| <a name="input_environment"></a> [environment](#input\_environment) | Values which are used to generate resource names and location short names. They are all mandatory except for domain, which should not be used only in the case of a resource used by multiple domains. | <pre>object({<br>    prefix    = string,<br>    env_short = string,<br>    location  = string,<br>    domain    = optional(string, "auth")<br>  })</pre> | n/a | yes |
| <a name="input_private_dns_zone_resource_group_name"></a> [private\_dns\_zone\_resource\_group\_name](#input\_private\_dns\_zone\_resource\_group\_name) | n/a | `string` | n/a | yes |
| <a name="input_resource_group_name"></a> [resource\_group\_name](#input\_resource\_group\_name) | n/a | `string` | n/a | yes |
| <a name="input_subnet_pep_id"></a> [subnet\_pep\_id](#input\_subnet\_pep\_id) | n/a | `string` | n/a | yes |
| <a name="input_tags"></a> [tags](#input\_tags) | n/a | `map(string)` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_audit"></a> [audit](#output\_audit) | n/a |
| <a name="output_maintenance"></a> [maintenance](#output\_maintenance) | n/a |
| <a name="output_session"></a> [session](#output\_session) | n/a |
<!-- END_TF_DOCS -->
