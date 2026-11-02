# Secrets

data "azurerm_key_vault_secret" "app_backend_api_key_secret" {
  name         = "appbackend-APP-BACKEND-PRIMARY-KEY"
  key_vault_id = var.key_vault_common_id
}

data "http" "external_api_session_manager_v2_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/f818c29f970a4e378e4ff41b1cc2824f6b68e5de/apps/io-session-manager-oi/api/external.yaml"
}

