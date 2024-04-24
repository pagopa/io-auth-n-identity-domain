terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "<= 3.100.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfappprodio"
    container_name       = "terraform-state"
    key                  = "io-auth-n-identity-domain.identity.tfstate"
  }
}

provider "azurerm" {
  features {
  }
}

module "federated_identities" {
  source = "github.com/pagopa/dx//infra/modules/azure_federated_identity_with_github"

  # To-Do not working
  # continuos_integration = {enable = false, roles = null}

  prefix       = local.prefix
  env_short    = local.env_short
  env          = local.session_manager_environment
  domain       = local.domain
  repositories = [local.repo_name]
  tags         = local.tags
}
