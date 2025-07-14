terraform {

  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
    }
    dx = {
      source  = "pagopa-dx/azure"
      version = ">= 0.0.6, < 1.0.0"
    }
  }
}
