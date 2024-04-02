locals {
  prefix    = "dx"
  env_short = "p"
  env       = "prod"
  domain    = "typescript"
  location  = "westeurope"
  project   = "${local.prefix}-${local.env_short}"

  repo_name = "dx-typescript"

  tags = {
    CostCenter  = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy   = "Terraform"
    Environment = "Prod"
    Owner       = "DevEx"
    Source      = "https://github.com/pagopa/dx-typescript"
  }
}
