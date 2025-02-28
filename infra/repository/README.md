# DX Typescript - GitHub Repository Settings

<!-- markdownlint-disable -->
<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_azurerm"></a> [azurerm](#requirement\_azurerm) | <= 3.100.0 |
| <a name="requirement_github"></a> [github](#requirement\_github) | 6.1.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | 3.100.0 |
| <a name="provider_github"></a> [github](#provider\_github) | 6.1.0 |

## Modules

No modules.

## Resources

| Name | Type |
|------|------|
| [github_actions_environment_secret.apps_prod_cd](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/actions_environment_secret) | resource |
| [github_actions_environment_secret.opex_prod_cd](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/actions_environment_secret) | resource |
| [github_actions_environment_secret.opex_prod_ci](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/actions_environment_secret) | resource |
| [github_actions_environment_secret.prod_cd](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/actions_environment_secret) | resource |
| [github_actions_environment_secret.prod_ci](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/actions_environment_secret) | resource |
| [github_actions_environment_variable.apps_prod_cd](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/actions_environment_variable) | resource |
| [github_actions_secret.repo_secrets](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/actions_secret) | resource |
| [github_branch_default.default_main](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/branch_default) | resource |
| [github_branch_protection.protection_main](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/branch_protection) | resource |
| [github_repository.this](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/repository) | resource |
| [github_repository_environment.apps_prod_cd](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/repository_environment) | resource |
| [github_repository_environment.opex_prod_cd](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/repository_environment) | resource |
| [github_repository_environment.opex_prod_ci](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/repository_environment) | resource |
| [github_repository_environment.prod_cd](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/repository_environment) | resource |
| [github_repository_environment.prod_ci](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/resources/repository_environment) | resource |
| [azurerm_client_config.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/client_config) | data source |
| [azurerm_key_vault.citizen_auth_kv](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault) | data source |
| [azurerm_key_vault_secret.sonacloud_token](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/key_vault_secret) | data source |
| [azurerm_subscription.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/subscription) | data source |
| [azurerm_user_assigned_identity.identity_apps_prod_cd](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/user_assigned_identity) | data source |
| [azurerm_user_assigned_identity.identity_prod_cd](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/user_assigned_identity) | data source |
| [azurerm_user_assigned_identity.identity_prod_ci](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/user_assigned_identity) | data source |
| [azurerm_user_assigned_identity.opex_identity_prod_cd](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/user_assigned_identity) | data source |
| [azurerm_user_assigned_identity.opex_identity_prod_ci](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/user_assigned_identity) | data source |
| [github_organization_teams.all](https://registry.terraform.io/providers/integrations/github/6.1.0/docs/data-sources/organization_teams) | data source |

## Inputs

No inputs.

## Outputs

No outputs.
<!-- END_TF_DOCS -->