module "iam_kv" {
  source = "../modules/iam"

  subscription_id = data.azurerm_subscription.current.subscription_id

  key_vault = {
    id                  = module.key_vaults.auth.id
    name                = module.key_vaults.auth.name
    resource_group_name = module.key_vaults.auth.resource_group_name
  }

  function_apps_principal_ids = {
    "${module.function_profile_async.function_app.function_app.name}"    = module.function_profile_async.function_app.function_app.principal_id
    "${module.function_profile_async.function_app.function_app.name}-st" = module.function_profile_async.function_app.function_app.slot.principal_id

    "${module.function_lollipop.function_app.function_app.name}"    = module.function_lollipop.function_app.function_app.principal_id,
    "${module.function_lollipop.function_app.function_app.name}-st" = module.function_lollipop.function_app.function_app.slot.principal_id

    "${module.function_lv.function_app.function_app.name}"    = module.function_lv.function_app.function_app.principal_id
    "${module.function_lv.function_app.function_app.name}-st" = module.function_lv.function_app.function_app.slot.principal_id

    "${module.function_session_manager_internal.function_app.function_app.name}"    = module.function_session_manager_internal.function_app.function_app.principal_id
    "${module.function_session_manager_internal.function_app.function_app.name}-st" = module.function_session_manager_internal.function_app.function_app.slot.principal_id

    "${module.function_profile.function_app.function_app.name}"    = module.function_profile.function_app.function_app.principal_id
    "${module.function_profile.function_app.function_app.name}-st" = module.function_profile.function_app.function_app.slot.principal_id

    "${module.function_public.function_app.function_app.name}"    = module.function_public.function_app.function_app.principal_id
    "${module.function_public.function_app.function_app.name}-st" = module.function_public.function_app.function_app.slot.principal_id
  }

  storage_account_principal_ids = {
    "${module.storage_accounts.session.name}" = module.storage_accounts.session.principal_id
    "${module.storage_accounts.audit.name}"   = module.storage_accounts.audit.principal_id
  }
}

module "iam_kv_ioweb" {
  source = "../modules/iam"

  subscription_id = data.azurerm_subscription.current.subscription_id

  key_vault = {
    id                  = data.azurerm_key_vault.ioweb.id
    name                = data.azurerm_key_vault.ioweb.name
    resource_group_name = data.azurerm_key_vault.ioweb.resource_group_name
  }

  function_apps_principal_ids = {
    "${module.function_web_profile.function_app.function_app.name}"    = module.function_web_profile.function_app.function_app.principal_id
    "${module.function_web_profile.function_app.function_app.name}-st" = module.function_web_profile.function_app.function_app.slot.principal_id

    "${module.function_profile.function_app.function_app.name}"    = module.function_profile.function_app.function_app.principal_id
    "${module.function_profile.function_app.function_app.name}-st" = module.function_profile.function_app.function_app.slot.principal_id
  }

  storage_account_principal_ids = {
    "${module.storage_accounts.audit.name}" = module.storage_accounts.audit.principal_id
  }
}
