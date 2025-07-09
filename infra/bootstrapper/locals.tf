locals {
  prefix          = "io"
  env_short       = "p"
  location        = "italynorth"
  domain          = "auth"
  instance_number = "01"

  adgroups = {
    admins_name    = "${local.prefix}-${local.env_short}-adgroup-auth-admins"
    devs_name      = "${local.prefix}-${local.env_short}-adgroup-auth-developers"
    externals_name = "${local.prefix}-${local.env_short}-adgroup-auth-externals"
  }

  runner = {
    cae_name                = "${local.prefix}-${local.env_short}-itn-github-runner-cae-01"
    cae_resource_group_name = "${local.prefix}-${local.env_short}-itn-github-runner-rg-01"
    secret = {
      kv_name                = "${local.prefix}-${local.env_short}-kv-common"
      kv_resource_group_name = "${local.prefix}-${local.env_short}-rg-common"
    }
  }

  apim = {
    name                = "${local.prefix}-${local.env_short}-itn-apim-01"
    resource_group_name = "${local.prefix}-${local.env_short}-itn-common-rg-01"
  }

  sbns = {
    name                = "${local.prefix}-${local.env_short}-itn-platform-sbns-01"
    resource_group_name = "${local.prefix}-${local.env_short}-itn-common-rg-01"
  }

  vnet = {
    name                = "${local.prefix}-${local.env_short}-itn-common-vnet-01"
    resource_group_name = "${local.prefix}-${local.env_short}-itn-common-rg-01"
  }

  private_dns = {
    resource_group_name = "${local.prefix}-${local.env_short}-rg-common"
  }

  nat_gateway = {
    resource_group_name = "${local.prefix}-${local.env_short}-itn-common-rg-01"
  }

  tf_storage_account = {
    name                = "iopitntfst001"
    resource_group_name = "terraform-state-rg"
  }

  repository = {
    name                     = "io-auth-n-identity-domain"
    description              = "Auth&Identity Monorepo"
    topics                   = ["auth", "io"]
    jira_boards_ids          = ["CES", "IO-PID"]
    reviewers_teams          = ["io-auth-n-identity-backend", "engineering-team-devex"]
    default_branch_name      = "main"
    infra_cd_policy_branches = ["main"]
    opex_cd_policy_branches  = ["main"]
    app_cd_policy_branches   = ["main"]
  }

  key_vault = {
    name                = "${local.prefix}-${local.env_short}-kv-common"
    resource_group_name = "${local.prefix}-${local.env_short}-rg-common"
  }

  repo_secrets = {
    "SONAR_TOKEN"       = data.azurerm_key_vault_secret.sonacloud_token.value
    "SLACK_WEBHOOK_URL" = data.azurerm_key_vault_secret.slack_webhook_url.value
  }

  tags = {
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    BusinessUnit   = "App IO"
    ManagementTeam = "IO Autenticazione"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/bootstrapper"
    CostCenter     = "TS000 - Tecnologia e Servizi"
  }
}
