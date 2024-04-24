locals {
  prefix    = "io"
  env_short = "p"

  session_manager_environment = "session-manager-prod"

  location_short = "weu"
  location       = "westeurope"
  domain         = "auth-n-identity"
  project        = "${local.prefix}-${local.env_short}-${local.location_short}-${local.domain}"

  repo_name = "io-auth-n-identity-domain"

  identity_rg = "${local.prefix}-${local.env_short}-identity-rg"

  tags = {
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "Auth&Identity"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/identity/prod/westeurope"
  }
}
