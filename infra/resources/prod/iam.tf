module "iam_kv" {
  source = "../modules/iam"

  subscription_id = data.azurerm_subscription.current.subscription_id

  key_vault = {
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

moved {
  from = module.iam_kv_ioweb.module.kv_func["fff812bb-3a9e-40fd-8e6c-dcfa6b94b51d"]
  to   = module.iam_kv_ioweb.module.kv_func["io-p-itn-auth-profile-func-02"]
}

moved {
  from = module.iam_kv_ioweb.module.kv_func["e3aa2d9e-3eda-406b-a064-f01849edf3cf"]
  to   = module.iam_kv_ioweb.module.kv_func["io-p-itn-auth-profile-func-02-st"]
}

moved {
  from = module.iam_kv.module.kv_func["c60e62e1-05cb-43d0-a958-9b75153184d2"]
  to   = module.iam_kv.module.kv_func["io-p-itn-auth-profas-func-02"]
}

moved {
  from = module.iam_kv.module.kv_func["6af06a8e-d9b4-458a-a02f-eee8bd87081e"]
  to   = module.iam_kv.module.kv_func["io-p-itn-auth-profas-func-02-st"]
}

moved {
  from = module.iam_kv.module.kv_func["0841384e-9cad-453d-b2da-73ed1d079555"]
  to   = module.iam_kv.module.kv_func["io-p-itn-auth-lollipop-func-02"]
}

moved {
  from = module.iam_kv.module.kv_func["00c42c7a-7fa8-43b8-b250-85d63c29d0cc"]
  to   = module.iam_kv.module.kv_func["io-p-itn-auth-lollipop-func-02-st"]
}

moved {
  from = module.iam_kv.module.kv_func["115eb3ca-00ee-4134-ad12-a9daaabff699"]
  to   = module.iam_kv.module.kv_func["io-p-itn-auth-lv-func-02"]
}

moved {
  from = module.iam_kv.module.kv_func["544c3add-da8b-4fc1-8e4f-0f750cfdafa8"]
  to   = module.iam_kv.module.kv_func["io-p-itn-auth-lv-func-02-st"]
}

moved {
  from = module.iam_kv.module.kv_func["321ab3f4-344b-4672-ab5a-029a4a72c452"]
  to   = module.iam_kv.module.kv_func["io-p-weu-auth-sm-int-func-01"]
}

moved {
  from = module.iam_kv.module.kv_func["9f0a1505-260e-46fc-a130-fea5519f7666"]
  to   = module.iam_kv.module.kv_func["io-p-weu-auth-sm-int-func-01-st"]
}

moved {
  from = module.iam_kv.module.kv_st["09ec3b06-f0d4-4517-8dde-95421606b7e0"]
  to   = module.iam_kv.module.kv_st["iopitnauthsessionst01"]
}


moved {
  from = module.iam_kv_ioweb.module.kv_func["io-p-itn-auth-function-web-profile-st"].module.key_vault.azurerm_role_assignment.secrets["io-p-itn-ioweb-rg-01|io-p-itn-ioweb-kv-01|reader"]
  to   = module.iam_kv_ioweb.module.kv_func["io-p-itn-auth-webprof-func-01-st"].module.key_vault.azurerm_role_assignment.secrets["io-p-itn-ioweb-rg-01|io-p-itn-ioweb-kv-01|reader"]
}
