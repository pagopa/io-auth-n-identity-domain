locals {
  prefix    = "io"
  env_short = "p"
  env       = "prod"
  domain    = "web-profile-backend"
  repo_name = "io-web-profile-backend"
  location  = "westeurope"
  itn_location  = "italynorth"

  tags = {
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "Auth&Identity"
    Source         = "https://github.com/pagopa/io-web-profile-backend/blob/main/infra/identity/prod"
  }
}
