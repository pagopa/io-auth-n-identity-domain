data "azurerm_resource_group" "core_domain_redis_rg" {
  name = "${local.project}-citizen-auth-data-rg-01"
}

data "azurerm_redis_cache" "core_domain_redis_common" {
  name                = "${local.project}-citizen-auth-redis-std-v6"
  resource_group_name = data.azurerm_resource_group.core_domain_redis_rg.name
}
