locals {
  repository = {
    name                     = "io-auth-n-identity-domain"
    description              = "Auth&Identity Monorepo"
    topics                   = ["auth", "io"]
    jira_boards_ids          = ["CES", "IOPID"]
    reviewers_teams          = ["io-auth-n-identity-backend", "io-foundation-identity-n-access-backend", "engineering-team-devex"]
    default_branch_name      = "main"
    infra_cd_policy_branches = ["main"]
    opex_cd_policy_branches  = ["main"]
    app_cd_policy_branches   = ["main"]
  }
}
