terraform {

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.96.0"
    }

  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfproddx"
    container_name       = "terraform-state"
    key                  = "io-auth-n-identity-domain.resources.prod.westeurope.tfstate"
  }
}

provider "azurerm" {
  features {
  }
}
