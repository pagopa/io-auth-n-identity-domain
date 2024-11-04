locals {
  prefix    = "io"
  env_short = "p"
  env       = "prod"
  domain    = "fast-login"

  repo_name = "io-functions-fast-login"

  tags = {
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "Auth&Identity"
    Source         = "https://github.com/pagopa/io-functions-fast-login"
  }
}
