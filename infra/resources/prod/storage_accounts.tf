module "storage_accounts" {
  source = "../modules/storage_accounts"

  resource_group_name = data.azurerm_resource_group.main_resource_group.name

  environment = {
    prefix    = local.prefix
    env_short = local.env_short
    location  = local.location
  }

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name
  subnet_pep_id                        = data.azurerm_subnet.private_endpoints_subnet.id

  lollipop_key_vault_key_id = module.key_vaults.lollipop_assertion_01.id

  tags = local.tags
}

module "storage_account_services" {
  source = "../modules/storage_account_services"

  storage_account = {
    id   = module.storage_accounts.session.id
    name = module.storage_accounts.session.name
  }

  containers = [
    "lollipop-assertions-01"
  ]

  encryption_scopes = {
    "lollipop-assertions-01" = module.storage_accounts.session.encryption_scopes["lollipop_assertions"]
  }

  queues = [
    "pubkeys-revoke-01",
    "expired-user-sessions-01"
  ]

  tables = [
    "lockedprofile01",
    "profileemails01"
  ]

  tags = local.tags
}
