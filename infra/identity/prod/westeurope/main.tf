terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "<= 3.97.1"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfinfprodio"
    container_name       = "terraform-state"
    key                  = "io-auth-n-identity-domain.identity.tfstate"
  }
}

provider "azurerm" {
  features {
  }
}

// `io-p-identity-rg` is already defined, it contains all the managed identity for io projects
data "azurerm_resource_group" "rg_identity" {
  name = local.identity_rg
}

module "federated_identities" {
  source = "../../../modules/azure_federated_identity_with_github"

  # To-Do not working
  # continuos_integration = {enable = false, roles = null}

  prefix       = local.prefix
  env_short    = local.env_short
  env          = local.env
  repositories = [local.repo_name]
  tags         = local.tags
}

