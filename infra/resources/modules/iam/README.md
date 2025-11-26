# iam

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
| <a name="module_kv_func"></a> [kv\_func](#module\_kv\_func) | pagopa-dx/azure-role-assignments/azurerm | ~> 1.1 |
| <a name="module_kv_st"></a> [kv\_st](#module\_kv\_st) | pagopa-dx/azure-role-assignments/azurerm | ~> 1.1 |

## Resources

| Name | Type |
|------|------|
| [azurerm_role_assignment.kv_keys_st](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_function_apps_principal_ids"></a> [function\_apps\_principal\_ids](#input\_function\_apps\_principal\_ids) | Map of Function App principal IDs to give secret access as reader | `map(string)` | `{}` | no |
| <a name="input_key_vault"></a> [key\_vault](#input\_key\_vault) | Details of the Key Vault to which the role will be applied | <pre>object({<br/>    name                = string<br/>    resource_group_name = string<br/>    id                  = string<br/>  })</pre> | n/a | yes |
| <a name="input_storage_account_principal_ids"></a> [storage\_account\_principal\_ids](#input\_storage\_account\_principal\_ids) | Map of Storage Account principal IDs to give crypto access as writer | `map(string)` | `{}` | no |
| <a name="input_subscription_id"></a> [subscription\_id](#input\_subscription\_id) | Id of the subscription where the Key Vault is located | `string` | n/a | yes |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
