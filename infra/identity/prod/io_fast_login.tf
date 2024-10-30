module "federated_identities_io_fast_login" {
  source = "github.com/pagopa/dx//infra/modules/azure_federated_identity_with_github?ref=main"

  continuos_integration = { enable = false }

  prefix       = local.prefix
  env_short    = local.env_short
  env          = local.io_fast_login_environment
  domain       = "${local.domain}-io-fast-login"
  location     = local.location
  repositories = [local.repo_name]
  tags         = local.tags
}
