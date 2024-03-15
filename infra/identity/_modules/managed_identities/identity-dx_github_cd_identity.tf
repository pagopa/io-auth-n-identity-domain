module "managed_identity_cd" {
  source = "github.com/pagopa/terraform-azurerm-v3//github_federated_identity?ref=v7.62.0"

  prefix    = local.prefix
  env_short = var.env_short
  domain    = "typescript"

  identity_role = "cd"

  github_federations = local.cd_github_federations

  cd_rbac_roles = {
    subscription_roles = local.environment_cd_roles.subscription
    resource_groups    = local.environment_cd_roles.resource_groups
  }

  tags = var.tags
}