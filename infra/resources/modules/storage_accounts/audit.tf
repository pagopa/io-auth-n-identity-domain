module "st_audit_01" {
  source  = "pagopa-dx/azure-storage-account/azurerm"
  version = "~> 1.0"

  environment = merge(
    var.environment,
    {
      app_name        = "audit",
      instance_number = "01"
  })

  resource_group_name = var.audit_resource_group_name

  private_dns_zone_resource_group_name = var.private_dns_zone_resource_group_name
  subnet_pep_id                        = var.subnet_pep_id

  tier = "l"

  subservices_enabled = {
    blob = true
  }

  blob_features = {
    versioning = true
  }

  tags = var.tags
}

resource "azurerm_management_lock" "st_audit_01" {
  name       = module.st_audit_01.name
  scope      = module.st_audit_01.id
  lock_level = "CanNotDelete"
  notes      = "This Storage Account can't be deleted"
}

resource "azurerm_storage_management_policy" "delete_after_2yrs" {
  storage_account_id = module.st_audit_01.id

  rule {
    enabled = true
    name    = "lv-logs-01-deleteafter2yrs"
    actions {
      version {
        delete_after_days_since_creation = 731
      }
      base_blob {
        delete_after_days_since_creation_greater_than = 731
      }
      snapshot {
        delete_after_days_since_creation_greater_than = 731
      }
    }
    filters {
      blob_types   = ["blockBlob"]
      prefix_match = ["lv-logs-01/logs"]
    }
  }

  rule {
    enabled = true
    name    = "audit-deleteafter2yrsplus1week"
    actions {
      version {
        delete_after_days_since_creation = 738
      }
      base_blob {
        delete_after_days_since_creation_greater_than = 738
      }
      snapshot {
        delete_after_days_since_creation_greater_than = 738
      }
    }
    filters {
      blob_types   = ["blockBlob"]
      prefix_match = ["ioweb-auditlogs-01/auditlogs"]
    }
  }
}
