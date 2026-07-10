terraform {
  required_version = ">= 1.14.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.7"
    }
    dx = {
      source = "pagopa-dx/azure"
    }
    azapi = {
      source  = "azure/azapi"
      version = "~> 2.9"
    }
  }
}
