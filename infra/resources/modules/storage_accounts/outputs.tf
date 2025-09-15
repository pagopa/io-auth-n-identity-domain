output "session" {
  value = {
    id                        = module.st_session_01.id
    name                      = module.st_session_01.name
    resource_group_name       = module.st_session_01.resource_group_name
    principal_id              = module.st_session_01.principal_id
    primary_connection_string = module.st_session_01.primary_connection_string
  }
}

output "audit" {
  value = {
    id                        = module.st_audit_01.id
    name                      = module.st_audit_01.name
    resource_group_name       = module.st_audit_01.resource_group_name
    principal_id              = module.st_audit_01.principal_id
    primary_connection_string = module.st_audit_01.primary_connection_string
  }
}

output "maintenance" {
  value = {
    id                        = module.st_maintenance_01.id
    name                      = module.st_maintenance_01.name
    resource_group_name       = module.st_maintenance_01.resource_group_name
    principal_id              = module.st_maintenance_01.principal_id
    primary_connection_string = module.st_maintenance_01.primary_connection_string
  }
}
