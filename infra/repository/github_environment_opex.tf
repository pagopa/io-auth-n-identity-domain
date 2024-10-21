## CI
resource "github_repository_environment" "opex_prod_ci" {
  environment = "opex-prod-ci"
  repository  = github_repository.this.name

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_actions_environment_secret" "opex_prod_ci" {
  for_each = local.opex_ci.secrets

  repository      = github_repository.this.name
  environment     = github_repository_environment.opex_prod_ci.environment
  secret_name     = each.key
  plaintext_value = each.value
}

## CD
resource "github_repository_environment" "opex_prod_cd" {
  environment = "opex-prod-cd"
  repository  = github_repository.this.name

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_actions_environment_secret" "opex_prod_cd" {
  for_each = local.opex_cd.secrets

  repository      = github_repository.this.name
  environment     = github_repository_environment.opex_prod_cd.environment
  secret_name     = each.key
  plaintext_value = each.value
}
