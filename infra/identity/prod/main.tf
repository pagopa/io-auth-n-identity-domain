terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.116.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "iopitntfst001"
    container_name       = "terraform-state"
    key                  = "io-auth-n-identity-domain.identity.tfstate"
  }
}

provider "azurerm" {
  features {
  }
}

module "federated_identities" {
  source = "github.com/pagopa/dx//infra/modules/azure_federated_identity_with_github?ref=main"

  prefix       = local.prefix
  env_short    = local.env_short
  env          = local.env
  domain       = local.domain
  location     = local.location
  repositories = [local.repo_name]
  tags         = local.tags

  continuos_integration = {
    enable = true
    roles = {
      subscription = [
        "Reader",
        "Reader and Data Access",
        "PagoPA IaC Reader",
        "DocumentDB Account Contributor"
      ]
      resource_groups = {
        terraform-state-rg = [
          "Storage Blob Data Contributor"
        ]
        io-p-rg-internal = [
          "API Management Service Contributor"
        ]
        io-p-itn-common-rg-01 = [
          "API Management Service Contributor"
        ]
      }
    }
  }

  continuos_delivery = {
    enable = true
    roles = {
      subscription = ["Contributor"]
      resource_groups = {
        terraform-state-rg = [
          "Storage Blob Data Contributor"
        ],
        io-p-itn-auth-lv-rg-01 = [
          "Role Based Access Control Administrator"
        ]
        io-p-itn-auth-webprof-rg-01 = [
          "Role Based Access Control Administrator"
        ]
        io-p-itn-auth-lollipop-rg-02 = [
          "Role Based Access Control Administrator"
        ]
        io-p-itn-auth-public-rg-01 = [
          "Role Based Access Control Administrator"
        ]
        io-p-rg-internal = [
          "API Management Service Contributor"
        ]
        io-p-itn-common-rg-01 = [
          "API Management Service Contributor"
        ]
      }
    }
  }
}

