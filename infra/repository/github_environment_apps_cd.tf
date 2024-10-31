resource "github_repository_environment" "apps_prod_cd" {
  environment = "apps-prod-cd"
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

####################################
# Secrets
# shared with all apps CD pipelines
####################################
resource "github_actions_environment_secret" "apps_prod_cd" {
  for_each = local.apps_cd.secrets

  repository      = github_repository.this.name
  environment     = github_repository_environment.apps_prod_cd.environment
  secret_name     = each.key
  plaintext_value = each.value
}

###################################
# Environments
# (1 set of variables for each app)
###################################
resource "github_actions_environment_variable" "session_manager_prod_cd" {
  for_each = local.apps_cd.variables.session_manager

  repository    = github_repository.this.name
  environment   = github_repository_environment.apps_prod_cd.environment
  variable_name = each.key
  value         = each.value
}

resource "github_actions_environment_variable" "io_fast_login_prod_cd" {
  for_each = local.apps_cd.variables.io_fast_login

  repository    = github_repository.this.name
  environment   = github_repository_environment.apps_prod_cd.environment
  variable_name = each.key
  value         = each.value
}
