locals {
  prefix    = "dxt"
  env_short = "p"
  env       = "prod"
  location  = "westeurope"
  project   = "${local.prefix}-${local.env_short}"

  repo_name = "dx-typescript"

  tags = {
    CostCenter  = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy   = "Terraform"
    Environment = "Prod"
    Owner       = "DevEx"
    Source      = "https://github.com/pagopa/dx-typescript/blob/main/infra/identity/prod/westeurope"
  }
}
