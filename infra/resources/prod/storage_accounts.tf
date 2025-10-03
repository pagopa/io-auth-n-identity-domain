module "storage_accounts" {
  source = "../modules/storage_accounts"

  resource_group_name       = data.azurerm_resource_group.main_resource_group.name
  audit_resource_group_name = data.azurerm_resource_group.audit.name

  environment = {
    prefix    = local.prefix
    env_short = local.env_short
    location  = local.location
  }

  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name
  subnet_pep_id                        = data.azurerm_subnet.private_endpoints_subnet.id

  tags = local.tags
}

resource "azurerm_storage_encryption_scope" "lollipop_assertions" {
  name               = "lollipopassertions01"
  storage_account_id = module.storage_accounts.session.id
  source             = "Microsoft.KeyVault"

  key_vault_key_id = module.key_vaults.lollipop_assertion_01.versionless_id
}

resource "azurerm_storage_encryption_scope" "lvlogs" {
  name               = "lvlogs01"
  storage_account_id = module.storage_accounts.audit.id
  source             = "Microsoft.KeyVault"

  key_vault_key_id = module.key_vaults.lv_logs_01.versionless_id
}

resource "azurerm_storage_encryption_scope" "ioweb_audit_logs" {
  name               = "iowebauditlogs01"
  storage_account_id = module.storage_accounts.audit.id
  source             = "Microsoft.KeyVault"

  key_vault_key_id = azurerm_key_vault_key.ioweb_audit_logs_01.versionless_id
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
    "lollipop-assertions-01" = azurerm_storage_encryption_scope.lollipop_assertions.name
  }

  queues = [
    local.pubkeys_revoke_queue_name,
    local.pubkeys_revoke_poison_queue_name,
    local.expired_user_sessions_queue_name,
    local.expired_user_sessions_poison_queue_name
  ]

  tables = [
    "lockedprofile01",
    local.profile_email_table_name
  ]

  tags = local.tags
}

module "storage_account_audit_services" {
  source = "../modules/storage_account_services"

  storage_account = {
    id   = module.storage_accounts.audit.id
    name = module.storage_accounts.audit.name
  }

  containers = [
    local.lv_audit_logs_container_name,
    local.immutable_audit_logs_container_name
  ]

  immutability_policies = {
    (local.lv_audit_logs_container_name)        = "731"
    (local.immutable_audit_logs_container_name) = "738"
  }

  encryption_scopes = {
    (local.lv_audit_logs_container_name)        = azurerm_storage_encryption_scope.lvlogs.name
    (local.immutable_audit_logs_container_name) = azurerm_storage_encryption_scope.ioweb_audit_logs.name
  }

  tags = local.tags
}

module "storage_account_maintenance_services" {
  source = "../modules/storage_account_services"

  storage_account = {
    id   = module.storage_accounts.maintenance.id
    name = module.storage_accounts.maintenance.name
  }

  containers = [
    "data-factory-exports-01"
  ]

  queues = [
    local.profile_migrate_services_preferences_from_legacy_queue_name,
    local.profile_migrate_services_preferences_from_legacy_poison_queue_name,
    "profiles-to-sanitize-01",
    local.profile_events_queue_name,
  ]

  tables = [
    local.validation_tokens_table_name
  ]

  tags = local.tags
}


resource "azurerm_monitor_diagnostic_setting" "io_storage_account_session_diagnostic_setting" {
  name                       = "${module.storage_accounts.session.name}-ds-01"
  target_resource_id         = "${module.storage_accounts.session.id}/queueServices/default"
  log_analytics_workspace_id = data.azurerm_application_insights.application_insights.workspace_id

  enabled_log {
    category = "StorageWrite"
  }

  metric {
    category = "Capacity"
    enabled  = false
  }
  metric {
    category = "Transaction"
    enabled  = false
  }
}
