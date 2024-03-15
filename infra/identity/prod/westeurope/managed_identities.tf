module "managed_identities" {
  source = "../../_modules/managed_identities"

  env_short = local.env_short
  location  = local.location

  tags = local.tags

  depends_on = [
    module.resource_groups
  ]
}
