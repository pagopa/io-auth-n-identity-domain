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
  immutable_audit_logs_container_name = "ioweb-auditlogs-01"

  apim_itn_name                     = "${local.project}-apim-01"
  apim_itn_resource_group_name      = "${local.project}-common-rg-01"
  platform_apim_name                = "${local.project}-platform-api-gateway-apim-01"
  platform_apim_resource_group_name = local.apim_itn_resource_group_name

  io_web_profile_bff_basepath = "ioweb/backend/api/v1"

  io_session_notifications_sub_max_delivery_count = 10

  pubkeys_revoke_queue_name                                          = "pubkeys-revoke-01"
  pubkeys_revoke_poison_queue_name                                   = "pubkeys-revoke-01-poison"
  expired_user_sessions_queue_name                                   = "expired-user-sessions-01"
  expired_user_sessions_poison_queue_name                            = "expired-user-sessions-01-poison"
  profile_migrate_services_preferences_from_legacy_queue_name        = "profile-migrate-services-preferences-from-legacy-01"
  profile_migrate_services_preferences_from_legacy_poison_queue_name = "profile-migrate-services-preferences-from-legacy-01-poison"

  profile_events_queue_name = "profile-events-01"

  profile_emails_table_name = "profileemails01"

  lv_audit_logs_container_name = "lv-logs-01"

  validation_tokens_table_name = "validationtokens01"

  rejected_login_logs_container_name = "rejected-login-logs-01"

  tags = {
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    Owner          = "IO"
    ManagementTeam = "IO Auth&Identity"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/tree/main/infra/resources/prod"
    CostCenter     = "TS310 - PAGAMENTI & SERVIZI"
  }
}

