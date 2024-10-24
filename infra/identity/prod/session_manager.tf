module "federated_identities_session_manager" {
  source = "github.com/pagopa/dx//infra/modules/azure_federated_identity_with_github?ref=main"

  continuos_integration = { enable = false }

  prefix       = local.prefix
  env_short    = local.env_short
  env          = local.session_manager_environment
  domain       = "${local.domain}-session-manager"
  location     = local.location
  repositories = [local.repo_name]
  tags         = local.tags
}
