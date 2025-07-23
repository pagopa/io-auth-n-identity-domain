module "infra_ci_roles" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.1"

  subscription_id = data.azurerm_subscription.current.subscription_id
  principal_id    = module.repo.identities["infra"]["ci"].principal_id

  key_vault = [
    {
      name                = data.azurerm_key_vault.ioweb.name
      resource_group_name = data.azurerm_key_vault.ioweb.resource_group_name
      has_rbac_support    = true
      description         = "Grant read access to Key Vault secrets for workflow identities"
      roles = {
        secrets = "reader"
      }
    }
  ]
}

module "infra_cd_roles" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.1"

  subscription_id = data.azurerm_subscription.current.subscription_id
  principal_id    = module.repo.identities["infra"]["cd"].principal_id

  key_vault = [
    {
      name                = data.azurerm_key_vault.ioweb.name
      resource_group_name = data.azurerm_key_vault.ioweb.resource_group_name
      has_rbac_support    = true
      description         = "Grant read access to Key Vault secrets for workflow identities"
      roles = {
        secrets = "reader"
      }
    }
  ]
}
