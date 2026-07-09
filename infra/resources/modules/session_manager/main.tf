terraform {

  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
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
