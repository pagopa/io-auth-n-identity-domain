locals {
  prefix    = "io"
  env_short = "p"
  env       = "prod"
  domain    = "auth"
  location  = "italynorth"
  repo_name = "io-auth-n-identity-domain"

  session_manager_environment      = "session-manager-prod"
  functions_fast_login_environment = "functions-fast-login-prod"

  tags = {
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "IO Autenticazione"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/identity/prod"
  }
}
