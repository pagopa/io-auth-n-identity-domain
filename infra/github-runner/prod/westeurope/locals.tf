locals {
  prefix    = "io"
  env_short = "p"
  location  = "westeurope"

  tags = {
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "Auth&Identity"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/identity/prod/westeurope"
  }
}
