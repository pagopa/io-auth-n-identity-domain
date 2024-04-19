locals {
  prefix    = "dxt"
  env_short = "p"
  env       = "prod"
  location  = "westeurope"
  project   = "${local.prefix}-${local.env_short}"

  repo_name = "io-auth-n-identity-domain"

  tags = {
    CostCenter  = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy   = "Terraform"
    Environment = "Prod"
    Owner       = "DevEx"
    Source      = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/identity/prod/westeurope"
  }
}
