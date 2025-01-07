terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "<= 3.103.1"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfappprodio"
    container_name       = "terraform-state"
    key                  = "io-web-profile-backend.prod.identity.tfstate"
  }
}

provider "azurerm" {
  features {
  }
}

module "federated_identities_opex" {
  source = "github.com/pagopa/dx//infra/modules/azure_federated_identity_with_github?ref=main"

  prefix       = local.prefix
  env_short    = local.env_short
  env          = "opex-${local.env}"
  domain       = "${local.domain}-opex"
  location     = local.location
  repositories = [local.repo_name]

  continuos_integration = {
    enable = true
    roles = {
      subscription = ["Reader"]
      resource_groups = {
        terraform-state-rg = [
          "Reader and Data Access"
        ],
        dashboards = [
          "Reader"
        ]
      }
    }
  }

  continuos_delivery = {
    enable = true
    roles = {
      subscription = ["Reader"]
      resource_groups = {
        terraform-state-rg = [
          "Storage Blob Data Contributor",
          "Reader and Data Access"
        ]
        dashboards = [
          "Contributor"
        ]
      }
    }
  }

  tags = local.tags
}

module "federated_identities" {
  source = "github.com/pagopa/dx//infra/modules/azure_federated_identity_with_github?ref=main"

  prefix       = local.prefix
  env_short    = local.env_short
  env          = local.env
  domain       = local.domain
  location     = local.itn_location
  repositories = [local.repo_name]
  tags         = local.tags

  continuos_delivery = {
    enable = true
    roles = {
      subscription = ["Contributor"]
      resource_groups = {
        terraform-state-rg = [
          "Storage Blob Data Contributor"
        ],
        io-p-itn-auth-webprof-rg-01 = [
          "Role Based Access Control Administrator"
        ]
      }
    }
  }
}
