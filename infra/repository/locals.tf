locals {
  project            = "io-p"
  location_short     = "weu"
  itn_location_short = "itn"
  domain             = "auth"

  identity_resource_group_name = "${local.project}-identity-rg"

  repo_secrets = {
    "ARM_TENANT_ID"       = data.azurerm_client_config.current.tenant_id,
    "ARM_SUBSCRIPTION_ID" = data.azurerm_subscription.current.subscription_id,
    "SONAR_TOKEN"         = data.azurerm_key_vault_secret.sonacloud_token.value
  }

  ci = {
    secrets = {
      "ARM_CLIENT_ID" = data.azurerm_user_assigned_identity.identity_prod_ci.client_id
    }
  }

  cd = {
    secrets = {
      "ARM_CLIENT_ID" = data.azurerm_user_assigned_identity.identity_prod_cd.client_id,
    }
    reviewers_teams = ["io-auth-n-identity-backend", "engineering-team-cloud-eng"]
  }

  # -------------------------
  # Session Manager Data
  # -------------------------
  citizen_auth_kv_name = "io-p-citizen-auth-kv"
  citizen_auth_kv_rg   = "io-p-citizen-auth-sec-rg"
  sonacloud_token_key  = "session-manager-repo-sonarcloud-token"

  apps_cd = {
    secrets = {
      "ARM_CLIENT_ID" = data.azurerm_user_assigned_identity.identity_apps_prod_cd.client_id,
    },
    variables = {
    },

    reviewers_teams = ["io-auth-n-identity-backend", "engineering-team-cloud-eng"]
  }

  # -------------------------
  # Opex CI
  # -------------------------

  opex_ci = {
    secrets = {
      "ARM_CLIENT_ID" = data.azurerm_user_assigned_identity.opex_identity_prod_ci.client_id,
    },
  }
  # -------------------------
  # Opex CD
  # -------------------------
  opex_cd = {
    secrets = {
      "ARM_CLIENT_ID" = data.azurerm_user_assigned_identity.opex_identity_prod_cd.client_id,
    },
  }
}
