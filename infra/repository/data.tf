data "azurerm_user_assigned_identity" "identity_prod_ci" {
  name                = "${local.project}-auth-n-identity-github-ci-identity"
  resource_group_name = local.identity_resource_group_name
}

data "azurerm_user_assigned_identity" "identity_prod_cd" {
  name                = "${local.project}-auth-n-identity-github-cd-identity"
  resource_group_name = local.identity_resource_group_name
}

data "azurerm_linux_web_app" "session_manager" {
  name                = local.session_manager_name
  resource_group_name = local.session_manager_resource_group_name
}
