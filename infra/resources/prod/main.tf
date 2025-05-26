terraform {

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.116"
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
  }

  storage_use_azuread = true
}
