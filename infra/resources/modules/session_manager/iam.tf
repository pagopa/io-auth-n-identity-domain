module "ca_iam" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 3.0"

  subscription_id = var.subscription_id
  principal_id    = module.sm_ca.principal_id

  key_vault = [{
    name                = var.key_vault.name
    resource_group_name = var.key_vault.resource_group_name
    description         = "Allow Session Manager Container App to read secrets"
    roles = {
      secrets = "reader"
    }
  }]

  storage_table = [{
    storage_account_name = var.locked_profiles.storage_account.name
    resource_group_name  = var.locked_profiles.storage_account.resource_group_name
    table_name           = var.locked_profiles.table_name
    role                 = "reader"
    description          = "Allow Session Manager Container App to read the locked profiles table"
  }]

  storage_queue = [
    {
      storage_account_name = data.azurerm_storage_account.io_com.name
      resource_group_name  = data.azurerm_storage_account.io_com.resource_group_name
      queue_name           = data.azurerm_storage_queue.push_notifications.name
      description          = "Allow Session Manager Container App to read from the IO-Communication notification queue"
      role                 = "reader"
    },
    {
      storage_account_name = data.azurerm_storage_account.io_com.name
      resource_group_name  = data.azurerm_storage_account.io_com.resource_group_name
      queue_name           = data.azurerm_storage_queue.push_notifications.name
      description          = "Allow Session Manager Container App to write to the IO-Communication notification queue"
      role                 = "writer"
    }
  ]

  managed_redis = [{
    id          = module.managed_redis.id
    role        = "writer"
    description = "Allow Session Manager Container App to read/write to the Azure Managed Redis cache"
  }]

  cosmos = [
    {
      account_name        = var.session_cosmos.account_name
      resource_group_name = var.session_cosmos.resource_group_name
      description         = "Allow Session Manager Container App to read/write the io-auth-SM CosmosDB database"
      role                = "writer"
      database            = var.session_cosmos.database_name
      collections         = ["session-tokens", "active-sessions", "lollipop-activations"]
    }
  ]
}
