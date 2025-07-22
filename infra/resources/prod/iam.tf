module "iam_kv" {
  source = "../modules/iam_kv"

  subscription_id = data.azurerm_subscription.current.subscription_id

  key_vault = {
    name                = module.key_vaults.auth.name
    resource_group_name = module.key_vaults.auth.resource_group_name
  }

  principal_ids = [
    module.function_profile_async.function_app.function_app.principal_id,
    module.function_profile_async.function_app.function_app.slot.principal_id,

    module.function_lollipop.function_app.function_app.principal_id,
    module.function_lollipop.function_app.function_app.slot.principal_id,

    module.function_lv.function_app.function_app.principal_id,
    module.function_lv.function_app.function_app.slot.principal_id,

    module.function_session_manager_internal.function_app.function_app.principal_id,
    module.function_session_manager_internal.function_app.function_app.slot.principal_id,
  ]
}

module "iam_kv_ioweb" {
  source = "../modules/iam_kv"

  subscription_id = data.azurerm_subscription.current.subscription_id

  key_vault = {
    name                = data.azurerm_key_vault.ioweb.name
    resource_group_name = data.azurerm_key_vault.ioweb.resource_group_name
  }

  principal_ids = [
    module.function_web_profile.function_app.function_app.principal_id,
    module.function_web_profile.function_app.function_app.slot.principal_id,

    module.function_profile.function_app.function_app.principal_id,
    module.function_profile.function_app.function_app.slot.principal_id,
  ]
}
