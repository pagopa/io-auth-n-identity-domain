# Secrets

data "azurerm_key_vault_secret" "app_backend_api_key_secret" {
  name         = "appbackend-APP-BACKEND-PRIMARY-KEY"
  key_vault_id = var.key_vault_common_id
}

data "http" "external_api_session_manager_v2_openapi" {
  url = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/a8c39a08b1293a490a840ea7513f9de9ed014173/apps/io-session-manager-oi/api/external.yaml"
}

