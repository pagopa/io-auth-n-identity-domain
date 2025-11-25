# storage_account_services

<!-- BEGIN_TF_DOCS -->
## Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | n/a |

## Modules

No modules.

## Resources

| Name | Type |
|------|------|
| [azurerm_storage_container.containers](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_container) | resource |
| [azurerm_storage_container_immutability_policy.immutability_policies](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_container_immutability_policy) | resource |
| [azurerm_storage_queue.queues](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_queue) | resource |
| [azurerm_storage_table.tables](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_table) | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_containers"></a> [containers](#input\_containers) | List container names | `set(string)` | `[]` | no |
| <a name="input_encryption_scopes"></a> [encryption\_scopes](#input\_encryption\_scopes) | A map of string containing the container name as key and the name of the encryption scope as value.<br/>  The name of the container must be set also in the `containers` variable, otherwise it will be ignored | `map(string)` | `{}` | no |
| <a name="input_immutability_policies"></a> [immutability\_policies](#input\_immutability\_policies) | "A map of string containing the name of containers that should have an immutability policies applied.<br/>  The map should have the container name as key and the number of days as value (e.g. `{ "container_name" = "10" }`).<br/>  The name of the container must be set also in the `containers` variable, otherwise it will be ignored | `map(string)` | `{}` | no |
| <a name="input_queues"></a> [queues](#input\_queues) | List of queue names | `set(string)` | `[]` | no |
| <a name="input_storage_account"></a> [storage\_account](#input\_storage\_account) | Details of the target Storage Account | <pre>object({<br/>    id   = string<br/>    name = string<br/>  })</pre> | n/a | yes |
| <a name="input_tables"></a> [tables](#input\_tables) | List of table names | `set(string)` | `[]` | no |
| <a name="input_tags"></a> [tags](#input\_tags) | n/a | `map(string)` | n/a | yes |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
