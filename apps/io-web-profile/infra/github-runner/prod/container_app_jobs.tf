module "container_app_job_selfhosted_runner" {
  source = "github.com/pagopa/dx//infra/modules/github_selfhosted_runner_on_container_app_jobs?ref=19b6c8a118cdd60671d603dac87d3663089d72a7"

  prefix    = local.prefix
  env_short = local.env_short

  repo_name              = "io-web-profile-backend"
  container_app_job_name = "ioweb-profile"

  container_app_environment = {
    name                = "${local.prefix}-${local.env_short}-github-runner-cae"
    resource_group_name = "${local.prefix}-${local.env_short}-github-runner-rg"
  }

  key_vault = {
    name                = "${local.prefix}-${local.env_short}-kv-common"
    resource_group_name = "${local.prefix}-${local.env_short}-rg-common"
  }

  tags = local.tags
}
