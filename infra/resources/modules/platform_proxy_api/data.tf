# Secrets

data "azurerm_key_vault_secret" "app_backend_api_key_secret" {
  name         = "appbackend-APP-BACKEND-PRIMARY-KEY"
  key_vault_id = var.key_vault_common_id
}

data "http" "external_api_session_manager_v2_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/heads/main/apps/io-session-manager-oi/api/external.yaml"
}

data "http" "sso_bpd_api_session_manager_v2_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/heads/main/apps/io-session-manager-oi/api/sso/bpd.yaml"
}

data "http" "sso_fims_api_session_manager_v2_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/heads/main/apps/io-session-manager-oi/api/sso/fims.yaml"
}

data "http" "sso_pagopa_api_session_manager_v2_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/heads/main/apps/io-session-manager-oi/api/sso/pagopa.yaml"
}

data "http" "sso_zendesk_api_session_manager_v2_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/heads/main/apps/io-session-manager-oi/api/sso/zendesk.yaml"
}
