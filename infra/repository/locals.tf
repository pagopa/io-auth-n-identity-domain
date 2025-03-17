locals {
  prefix          = "io"
  env_short       = "p"
  location        = "italynorth"
  domain          = "auth"
  instance_number = "01"

  adgroups = {
    admins_name    = "io-p-adgroup-auth-admins"
    devs_name      = "io-p-adgroup-auth-developers"
    externals_name = "io-p-adgroup-auth-externals"
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

  vnet = {
    name                = "${local.prefix}-${local.env_short}-itn-common-vnet-01"
    resource_group_name = "${local.prefix}-${local.env_short}-itn-common-rg-01"
  }

  dns = {
    resource_group_name = "${local.prefix}-${local.env_short}-rg-external"
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
    reviewers_teams          = ["io-auth-n-identity-backend", "engineering-team-cloud-eng"]
    default_branch_name      = "main"
    infra_cd_policy_branches = ["main"]
    opex_cd_policy_branches  = ["main"]
    app_cd_policy_branches   = ["main"]
  }

  key_vault = {
    name                = "io-p-kv-common"
    resource_group_name = "io-p-rg-common"
  }

  tags = {
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    BusinessUnit   = "App IO"
    ManagementTeam = "IO Autenticazione"
    Source         = "https://github.com/pagopa/io-auth-n-identity-domain/blob/main/infra/repository"
    CostCenter     = "TS000 - Tecnologia e Servizi"
  }
}
