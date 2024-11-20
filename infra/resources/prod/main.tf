terraform {

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "<= 3.116.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfinfprodio"
    container_name       = "terraform-state"
    key                  = "io-auth-n-identity-domain.resources.prod.tfstate"
  }
}

provider "azurerm" {
  features {
  }
}


data "azurerm_client_config" "current" {}