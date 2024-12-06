locals {
  prefix             = "io"
  env_short          = "p"
  location_short     = "itn"
  weu_location_short = "weu"
  location           = "italynorth"
  project            = "${local.prefix}-${local.env_short}-${local.location_short}"
  weu_project        = "${local.prefix}-${local.env_short}-${local.weu_location_short}"
  domain             = "auth"
  legacy_domain      = "citizen-${local.domain}"

  common_project = "${local.prefix}-${local.env_short}"

  lollipop_jwt_host = "api.io.pagopa.it"

  appgw_resource_group_name           = "${local.common_project}-rg-external"
  immutable_audit_logs_container_name = "auditlogs"

  tags = {
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "IO Auth&Identity"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/tree/main/infra/resources/prod"
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
  }
}

