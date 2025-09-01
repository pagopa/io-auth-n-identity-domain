terraform {

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azapi = {
      source  = "azure/azapi"
      version = "~>2.4.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "iopitntfst001"
    container_name       = "terraform-state"
    key                  = "io-auth-n-identity-domain.resources.prod.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {
    key_vault {
      recover_soft_deleted_keys             = true
      purge_soft_deleted_secrets_on_destroy = true
    }
  }

  storage_use_azuread = true
}

provider "azapi" {
}
