locals {
  prefix         = "io"
  env_short      = "p"
  location_short = "itn"
  location       = "italynorth"
  project        = "${local.prefix}-${local.env_short}-${local.location_short}"
  domain         = "auth"

  common_project = "${local.prefix}-${local.env_short}"

  tags = {
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "IO Auth&Identity"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/tree/main/infra/resources/prod"
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
  }

  scaling_gate = {
    name     = "wallet_gate2"
    timezone = "W. Europe Standard Time"
    start    = "2024-11-06T08:00:00.00Z"
    end      = "2024-11-06T22:00:00.00Z"
  }
}

