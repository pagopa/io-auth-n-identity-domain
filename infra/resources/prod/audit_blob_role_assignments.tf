module "role_assignments_web_profile_audit_blob" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.0"

  principal_id    = module.function_web_profile.function_app.function_app.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  storage_blob = [
    {
      storage_account_name = module.storage_accounts.audit.name
      resource_group_name  = module.storage_accounts.audit.resource_group_name
      role                 = "writer"
      description          = "Allow io-web-profile to write audit logs to blob storage"
    }
  ]
}

module "role_assignments_web_profile_staging_audit_blob" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.0"

  principal_id    = module.function_web_profile.function_app.function_app.slot.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  storage_blob = [
    {
      storage_account_name = module.storage_accounts.audit.name
      resource_group_name  = module.storage_accounts.audit.resource_group_name
      role                 = "writer"
      description          = "Allow the io-web-profile staging slot to write audit logs to blob storage"
    }
  ]
}

module "role_assignments_fast_login_audit_blob" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.0"

  principal_id    = module.function_lv.function_app.function_app.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  storage_blob = [
    {
      storage_account_name = module.storage_accounts.audit.name
      resource_group_name  = module.storage_accounts.audit.resource_group_name
      role                 = "writer"
      description          = "Allow io-fast-login to write audit logs to blob storage"
    }
  ]
}

module "role_assignments_fast_login_staging_audit_blob" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.0"

  principal_id    = module.function_lv.function_app.function_app.slot.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  storage_blob = [
    {
      storage_account_name = module.storage_accounts.audit.name
      resource_group_name  = module.storage_accounts.audit.resource_group_name
      role                 = "writer"
      description          = "Allow the io-fast-login staging slot to write audit logs to blob storage"
    }
  ]
}
