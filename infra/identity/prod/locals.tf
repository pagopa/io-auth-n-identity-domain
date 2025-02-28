locals {
  prefix    = "io"
  env_short = "p"
  env       = "prod"
  domain    = "auth"
  location  = "italynorth"
  repo_name = "io-auth-n-identity-domain"

  apps_cd_environment = "apps-prod"

  tags = {
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "IO Autenticazione"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/identity/prod"
  }
}
