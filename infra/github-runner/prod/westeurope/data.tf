data "azurerm_container_app_environment" "github-runner-cae" {
  name                = "${local.prefix}-${local.env_short}-github-runner-cae"
  resource_group_name = "${local.prefix}-${local.env_short}-github-runner-rg"
}