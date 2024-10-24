resource "github_repository_environment" "session_manager_prod_cd" {
  environment = "session-manager-prod-cd"
  repository  = github_repository.this.name

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }

  reviewers {
    teams = matchkeys(
      data.github_organization_teams.all.teams[*].id,
      data.github_organization_teams.all.teams[*].slug,
      local.cd.reviewers_teams
    )
  }
}

resource "github_actions_environment_secret" "session_manager_prod_cd" {
  for_each = local.session_manager_cd.secrets

  repository      = github_repository.this.name
  environment     = github_repository_environment.session_manager_prod_cd.environment
  secret_name     = each.key
  plaintext_value = each.value
}

resource "github_actions_environment_variable" "session_manager_prod_cd" {
  for_each = local.session_manager_cd.variables

  repository    = github_repository.this.name
  environment   = github_repository_environment.session_manager_prod_cd.environment
  variable_name = each.key
  value         = each.value
}
