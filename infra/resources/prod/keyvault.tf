data "azurerm_key_vault" "kv" {
  name                = "${local.common_project}-citizen-auth-kv"
  resource_group_name = "${local.common_project}-citizen-auth-sec-rg"
}

data "azurerm_key_vault" "ioweb_kv" {
  name                = "${local.project}-ioweb-kv-01"
  resource_group_name = "${local.project}-${local.domain}-main-rg-01"
}

data "azurerm_key_vault" "common_kv" {
  name                = "${local.common_project}-kv-common"
  resource_group_name = "${local.common_project}-rg-common"
}

data "azurerm_key_vault_secret" "profile_async_session_manager_internal_api_key" {
  name         = "profile-async-session-manager-internal-key"
  key_vault_id = data.azurerm_key_vault.kv.id
}

module "key_vaults" {
  source = "../modules/key_vaults"

  resource_group_name = data.azurerm_resource_group.main_resource_group.name
  tenant_id           = data.azurerm_client_config.current.tenant_id

  environment = {
    prefix      = local.prefix
    environment = local.env_short
    location    = local.location
  }

  tags = local.tags
}
