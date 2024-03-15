terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "<= 3.94.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfproddx"
    container_name       = "terraform-state"
    key                  = "dx-typescript.identity.tfstate"
  }
}

provider "azurerm" {
  features {
  }
}

data "azurerm_subscription" "current" {}

data "azurerm_client_config" "current" {}
