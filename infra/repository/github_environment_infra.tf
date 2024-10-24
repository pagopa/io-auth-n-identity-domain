resource "github_repository_environment" "prod_ci" {
  environment = "prod-ci"
  repository  = github_repository.this.name

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_actions_environment_secret" "prod_ci" {
  for_each = local.ci.secrets

  repository      = github_repository.this.name
  environment     = github_repository_environment.prod_ci.environment
  secret_name     = each.key
  plaintext_value = each.value
}

resource "github_repository_environment" "prod_cd" {
  environment = "prod-cd"
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

resource "github_actions_environment_secret" "prod_cd" {
  for_each = local.cd.secrets

  repository      = github_repository.this.name
  environment     = github_repository_environment.prod_cd.environment
  secret_name     = each.key
  plaintext_value = each.value
}
