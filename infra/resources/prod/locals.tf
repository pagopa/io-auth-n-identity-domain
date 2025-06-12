locals {
  prefix             = "io"
  env_short          = "p"
  location_short     = "itn"
  weu_location_short = "weu"
  location           = "italynorth"
  weu_location       = "westeurope"
  project            = "${local.prefix}-${local.env_short}-${local.location_short}"
  weu_project        = "${local.prefix}-${local.env_short}-${local.weu_location_short}"
  domain             = "auth"
  legacy_domain      = "citizen-${local.domain}"

  common_project = "${local.prefix}-${local.env_short}"

  lollipop_jwt_host = "api.io.pagopa.it"

  appgw_resource_group_name           = "${local.project}-common-rg-01"
  immutable_audit_logs_container_name = "auditlogs"

  apim_itn_name                     = "${local.prefix}-${local.env_short}-itn-apim-01"
  apim_itn_resource_group_name      = "${local.prefix}-${local.env_short}-itn-common-rg-01"
  platform_apim_name                = "${local.common_project}-${local.location_short}-platform-api-gateway-apim-01"
  platform_apim_resource_group_name = local.apim_itn_resource_group_name

  io_web_profile_bff_basepath = "ioweb/backend/api/v1"

  io_session_notifications_sub_max_delivery_count = 10

  tags = {
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "IO Auth&Identity"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/tree/main/infra/resources/prod"
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
  }
}

