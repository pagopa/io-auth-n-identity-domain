module "container_app_job_selfhosted_runner" {
  source = "github.com/pagopa/dx//infra/modules/github_selfhosted_runner_on_container_app_jobs?ref=main"

  repository = { name : "io-auth-n-identity-domain" }

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    instance_number = "01"
  }

  container_app_environment = {
    id                         = data.azurerm_container_app_environment.github-runner-cae.id
    location                   = local.location
    replica_timeout_in_seconds = 3600
    cpu                        = 1
    memory                     = "2Gi"
  }

  resource_group_name = "${local.prefix}-${local.env_short}-github-runner-rg"

  key_vault = {
    name                = "${local.prefix}-${local.env_short}-kv-common"
    resource_group_name = "${local.prefix}-${local.env_short}-rg-common"
  }

  tags = local.tags
}
