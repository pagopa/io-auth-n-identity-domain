module "federated_identities_apps" {
  source  = "pagopa/dx-azure-federated-identity-with-github/azurerm"
  version = "~> 0"
  
  continuos_integration = { enable = false }

  prefix       = local.prefix
  env_short    = local.env_short
  env          = local.apps_cd_environment
  domain       = "${local.domain}-apps"
  location     = local.location
  repositories = [local.repo_name]
  tags         = local.tags
}
