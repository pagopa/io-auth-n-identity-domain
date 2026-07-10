terraform {

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>4.7"
    }
    dx = {
      source = "pagopa-dx/azure"
    }
    azapi = {
      source  = "azure/azapi"
      version = "~>2.9"
    }
  }
}
