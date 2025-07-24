output "session" {
  value = {
    id                  = module.st_session_01.id
    name                = module.st_session_01.name
    resource_group_name = module.st_session_01.resource_group_name
    principal_id        = module.st_session_01.principal_id
  }
}

output "audit" {
  value = {
    id                  = module.st_audit_01.id
    name                = module.st_audit_01.name
    resource_group_name = module.st_audit_01.resource_group_name
    principal_id        = module.st_audit_01.principal_id
  }
}
