data "azurerm_resource_group" "core_domain_redis_rg" {
  name = "${local.project}-citizen-auth-data-rg-01"
}

data "azurerm_redis_cache" "core_domain_redis_common" {
  name                = "${local.project}-citizen-auth-redis-std-v6"
  resource_group_name = data.azurerm_resource_group.core_domain_redis_rg.name
}

data "azurerm_redis_cache" "redis_common" {
  name                = "${local.common_project}-redis-common"
  resource_group_name = data.azurerm_resource_group.rg_common.name
}

module "redis_common_itn" {
  source              = "github.com/pagopa/terraform-azurerm-v4//redis_cache?ref=v7.40.3"
  name                = "${local.project}-${local.domain}-redis-01"
  resource_group_name = data.azurerm_resource_group.core_domain_redis_rg.name
  location            = local.location

  capacity              = 1
  family                = "P"
  sku_name              = "Premium"
  redis_version         = "6"
  enable_authentication = true
  custom_zones          = [1, 2]

  // when azure can apply patch?
  patch_schedules = [{
    day_of_week    = "Sunday"
    start_hour_utc = 23
    },
    {
      day_of_week    = "Monday"
      start_hour_utc = 23
    },
    {
      day_of_week    = "Tuesday"
      start_hour_utc = 23
    },
    {
      day_of_week    = "Wednesday"
      start_hour_utc = 23
    },
    {
      day_of_week    = "Thursday"
      start_hour_utc = 23
    },
  ]


  private_endpoint = {
    enabled              = true
    virtual_network_id   = data.azurerm_virtual_network.itn_common.id
    subnet_id            = data.azurerm_subnet.private_endpoints_subnet.id
    private_dns_zone_ids = [data.azurerm_private_dns_zone.privatelink_redis_cache.id]
  }

  tags = local.tags
}
