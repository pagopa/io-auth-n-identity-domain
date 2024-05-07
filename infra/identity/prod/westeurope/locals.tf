locals {
  prefix    = "io"
  env_short = "p"
  env       = "prod"
  domain    = "auth-n-identity"
  repo_name = "io-auth-n-identity-domain"

  session_manager_environment = "session-manager-prod"

  tags = {
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "Auth&Identity"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/identity/prod/westeurope"
  }
}
