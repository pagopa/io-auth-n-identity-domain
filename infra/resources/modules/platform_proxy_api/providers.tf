terraform {
  required_providers {
    azapi = {
      source  = "azure/azapi"
      version = "~>2.9"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.5"
    }
  }
}
