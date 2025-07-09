data "azurerm_resource_group" "rg_elt" {
  name = "${local.project}-${local.domain}-elt-rg-01"
}

module "eventhub" {
  source              = "../modules/eventhub"
  prefix              = local.prefix
  env_short           = local.env_short
  location            = local.location
  domain              = local.domain
  resource_group_name = data.azurerm_resource_group.rg_elt.name

  peps_snet_id                         = data.azurerm_subnet.private_endpoints_subnet.id
  private_dns_zone_resource_group_name = "io-p-evt-rg"

  tags = local.tags
}
