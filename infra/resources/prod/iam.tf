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
  ]
}
