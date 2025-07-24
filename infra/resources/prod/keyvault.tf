data "azurerm_key_vault" "kv" {
  name                = "${local.common_project}-citizen-auth-kv"
  resource_group_name = "${local.common_project}-citizen-auth-sec-rg"
}

data "azurerm_key_vault" "common_kv" {
  name                = "${local.common_project}-kv-common"
  resource_group_name = "${local.common_project}-rg-common"
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


resource "azurerm_key_vault_key" "ioweb_audit_logs_01" {
  name         = "ioweb-audit-logs-01"
  key_vault_id = data.azurerm_key_vault.ioweb.id
  key_type     = "RSA"
  key_size     = 4096

  key_opts = [
    "decrypt",
    "encrypt",
    "sign",
    "unwrapKey",
    "verify",
    "wrapKey"
  ]

  tags = local.tags
}

