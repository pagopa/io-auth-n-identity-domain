resource "github_repository_environment" "github_repository_environment_session_manager_prod_cd" {
  environment = "session-manager-prod-cd"
  repository  = github_repository.this.name

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_actions_environment_secret" "env_prod_cd_secrets" {
  for_each = local.session_manager_cd.secrets

  repository      = github_repository.this.name
  environment     = github_repository_environment.github_repository_environment_session_manager_prod_cd.environment
  secret_name     = each.key
  plaintext_value = each.value
}

resource "github_actions_environment_variable" "env_prod_cd_variables" {
  for_each = local.session_manager_cd.variables

  repository    = github_repository.this.name
  environment   = github_repository_environment.github_repository_environment_session_manager_prod_cd.environment
  variable_name = each.key
  value         = each.value
}
