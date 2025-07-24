module "kv_func" {
  for_each = var.function_apps_principal_ids

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

module "kv_st" {
  for_each = var.storage_account_principal_ids

  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.1"

  subscription_id = var.subscription_id
  principal_id    = each.value

  key_vault = [
    {
      name                = var.key_vault.name
      resource_group_name = var.key_vault.resource_group_name
      has_rbac_support    = true
      description         = "Grant write access to Key Vault crypto for provided Storage Account"
      roles = {
        keys = "writer"
      }
    }
  ]
}

resource "azurerm_role_assignment" "kv_keys_st" {
  for_each = var.storage_account_principal_ids

  scope                = var.key_vault.id
  role_definition_name = "Key Vault Crypto Service Encryption User"
  principal_id         = each.value
  description          = "Allow Storage Account to use Key Vault keys for encryption operations"
}
