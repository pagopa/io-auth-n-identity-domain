module "st_session_01" {
  source  = "pagopa-dx/azure-storage-account/azurerm"
  version = "~> 1.0"

  environment = merge(
    var.environment,
    {
      app_name        = "session",
      instance_number = "01"
  })

  resource_group_name = var.resource_group_name

  private_dns_zone_resource_group_name = var.private_dns_zone_resource_group_name
  subnet_pep_id                        = var.subnet_pep_id

  tier = "l"

  subservices_enabled = {
    blob  = true
    table = true
    queue = true
  }

  tags = var.tags
}

resource "azurerm_management_lock" "st_session_01" {
  name       = module.st_session_01.name
  scope      = module.st_session_01.id
  lock_level = "CanNotDelete"
  notes      = "This Storage Account can't be deleted"
}
