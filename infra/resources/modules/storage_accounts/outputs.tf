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
