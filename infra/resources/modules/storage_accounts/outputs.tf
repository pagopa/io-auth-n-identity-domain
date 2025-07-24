output "session" {
  value = {
    id                  = module.st_session_01.id
    name                = module.st_session_01.name
    resource_group_name = module.st_session_01.resource_group_name
    principal_id        = module.st_session_01.principal_id
    encryption_scopes = {
      lollipop_assertions = azurerm_storage_encryption_scope.lollipop_assertions.name
    }
  }
}

output "audit" {
  value = {
    id                  = module.st_audit_01.id
    name                = module.st_audit_01.name
    resource_group_name = module.st_audit_01.resource_group_name
    principal_id        = module.st_audit_01.principal_id
    encryption_scopes = {
      lv_logs          = azurerm_storage_encryption_scope.lvlogs.name
      ioweb_audit_logs = azurerm_storage_encryption_scope.ioweb_audit_logs.name
    }
  }
}
