module "kv_func" {
  for_each = var.principal_ids

  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.1"

  subscription_id = var.subscription_id
  principal_id    = each.value

  key_vault = [
    {
      name                = var.key_vault.name
      resource_group_name = var.key_vault.resource_group_name
      has_rbac_support    = true
      description         = "Grant read access to Key Vault secrets for provided Function Apps"
      roles = {
        secrets = "reader"
      }
    }
  ]
}
