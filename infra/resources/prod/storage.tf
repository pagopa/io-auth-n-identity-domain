data "azurerm_storage_account" "immutable_lv_audit_logs_storage" {
  name                = replace("${local.common_project}-lv-logs-im-st", "-", "")
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
}

###################
## IOWEB-PROFILE ##
###################
resource "azurerm_resource_group" "io_web_profile_fe_rg" {
  name     = format("%s-%s-%s-%s-ioweb-fe-rg-01", local.prefix, local.env_short, local.location_short, local.domain)
  location = local.location
}

module "storage_account_io_web_profile_fe" {
  source = "github.com/pagopa/dx//infra/modules/azure_storage_account?ref=main"

  // s tier -> Standard LRS
  // l tier -> Standard ZRS
  tier = "l"

  # NOTE: domain omitted for characters shortage
  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    app_name        = replace("ioweb-profile", "-", "")
    instance_number = "01"
  }
  access_tier = "Hot"

  resource_group_name                  = azurerm_resource_group.io_web_profile_fe_rg.name
  subnet_pep_id                        = data.azurerm_subnet.private_endpoints_subnet.id
  private_dns_zone_resource_group_name = data.azurerm_resource_group.rg_common.name

  # storage should be accessible by CDN via private endpoint
  # see https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/how-to-enable-private-link-storage-account
  force_public_network_access_enabled = false
  subservices_enabled = {
    blob = true
  }
  blob_features = {
    versioning = true
    change_feed = {
      enabled = false
    }
    immutability_policy = {
      enabled = false
    }
  }

  static_website = {
    index_document     = "index.html"
    error_404_document = "it/404/index.html"
  }

  tags = local.tags
}
###################
