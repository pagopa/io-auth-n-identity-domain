terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>4"
    }

    azuread = {
      source  = "hashicorp/azuread"
      version = "~>3"
    }

    github = {
      source  = "integrations/github"
      version = "~>6"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "iopitntfst001"
    container_name       = "terraform-state"
    key                  = "io-auth-n-identity-domain.bootstrapper.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {}
  storage_use_azuread = true
}

provider "github" {
  owner = "pagopa"
}

data "azurerm_subscription" "current" {}

data "azurerm_client_config" "current" {}

data "azurerm_container_app_environment" "runner" {
  name                = local.runner.cae_name
  resource_group_name = local.runner.cae_resource_group_name
}

data "azurerm_api_management" "apim" {
  name                = local.apim.name
  resource_group_name = local.apim.resource_group_name
}

data "azurerm_servicebus_namespace" "sbns" {
  name                = local.sbns.name
  resource_group_name = local.sbns.resource_group_name
}

data "azurerm_key_vault" "common" {
  name                = local.key_vault.name
  resource_group_name = local.key_vault.resource_group_name
}

data "azurerm_virtual_network" "common" {
  name                = local.vnet.name
  resource_group_name = local.vnet.resource_group_name
}

data "azurerm_resource_group" "common_weu" {
  name = local.private_dns.resource_group_name
}

data "azurerm_resource_group" "itn_common_rg_01" {
  name = local.nat_gateway.resource_group_name
}

data "azurerm_resource_group" "dashboards" {
  name = "dashboards"
}

data "azuread_group" "admins" {
  display_name = local.adgroups.admins_name
}

data "azuread_group" "developers" {
  display_name = local.adgroups.devs_name
}

data "azuread_group" "externals" {
  display_name = local.adgroups.externals_name
}

module "repo" {
  source  = "pagopa-dx/azure-github-environment-bootstrap/azurerm"
  version = "~>2.0"

  environment = {
    prefix          = local.prefix
    env_short       = local.env_short
    location        = local.location
    domain          = local.domain
    instance_number = local.instance_number
  }

  subscription_id = data.azurerm_subscription.current.id
  tenant_id       = data.azurerm_client_config.current.tenant_id

  additional_resource_group_ids = [
    azurerm_resource_group.data_weu.id,
    azurerm_resource_group.sec_weu.id,
    azurerm_resource_group.common_itn_01.id,
    azurerm_resource_group.elt_itn_01.id,
    azurerm_resource_group.lollipop_itn_02.id,
    azurerm_resource_group.lv_itn_01.id,
    azurerm_resource_group.main_itn_01.id,
    azurerm_resource_group.public_itn_01.id,
    azurerm_resource_group.auth_itn_01.id,
    azurerm_resource_group.webprof_itn_01.id,
    azurerm_resource_group.data_itn_01.id,
    azurerm_resource_group.session_manager_weu_01.id,
    azurerm_resource_group.shared_itn_01.id,
    azurerm_resource_group.ioweb_common_weu.id,
    azurerm_resource_group.storage_weu.id,
    azurerm_resource_group.audit_itn_01.id,
  ]

  entraid_groups = {
    admins_object_id    = data.azuread_group.admins.object_id
    devs_object_id      = data.azuread_group.developers.object_id
    externals_object_id = data.azuread_group.externals.object_id
  }

  terraform_storage_account = {
    name                = local.tf_storage_account.name
    resource_group_name = local.tf_storage_account.resource_group_name
  }

  repository = {
    name                     = local.repository.name
    description              = local.repository.description
    topics                   = local.repository.topics
    jira_boards_ids          = local.repository.jira_boards_ids
    reviewers_teams          = local.repository.reviewers_teams
    default_branch_name      = local.repository.default_branch_name
    infra_cd_policy_branches = local.repository.infra_cd_policy_branches
    opex_cd_policy_branches  = local.repository.opex_cd_policy_branches
    app_cd_policy_branches   = local.repository.app_cd_policy_branches
  }

  github_private_runner = {
    container_app_environment_id       = data.azurerm_container_app_environment.runner.id
    container_app_environment_location = data.azurerm_container_app_environment.runner.location
    key_vault = {
      name                = local.runner.secret.kv_name
      resource_group_name = local.runner.secret.kv_resource_group_name
    }
    cpu    = 1
    memory = "2Gi"
  }

  apim_id                            = data.azurerm_api_management.apim.id
  sbns_id                            = data.azurerm_servicebus_namespace.sbns.id
  pep_vnet_id                        = data.azurerm_virtual_network.common.id
  private_dns_zone_resource_group_id = data.azurerm_resource_group.common_weu.id
  opex_resource_group_id             = data.azurerm_resource_group.dashboards.id
  nat_gateway_resource_group_id      = data.azurerm_resource_group.itn_common_rg_01.id
  keyvault_common_ids = [
    data.azurerm_key_vault.common.id
  ]

  tags = local.tags
}
