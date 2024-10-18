data "azurerm_user_assigned_identity" "identity_prod_ci" {
  name                = "${local.project}-auth-github-ci-identity"
  resource_group_name = local.identity_resource_group_name
}

data "azurerm_user_assigned_identity" "identity_session_manager_prod_cd" {
  name                = "${local.project}-auth-session-manager-github-cd-identity"
  resource_group_name = local.identity_resource_group_name
}

data "azurerm_key_vault" "citizen_auth_kv" {
  name                = local.citizen_auth_kv_name
  resource_group_name = local.citizen_auth_kv_rg
}

data "azurerm_key_vault_secret" "sonacloud_token" {
  key_vault_id = data.azurerm_key_vault.citizen_auth_kv.id
  name         = local.sonacloud_token_key
}

data "azurerm_user_assigned_identity" "opex_identity_prod_ci" {
  name                = "${local.project}-auth-opex-github-ci-identity"
  resource_group_name = local.identity_resource_group_name
}

data "azurerm_user_assigned_identity" "opex_identity_prod_cd" {
  name                = "${local.project}-auth-opex-github-cd-identity"
  resource_group_name = local.identity_resource_group_name
}
