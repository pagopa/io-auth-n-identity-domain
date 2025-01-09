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
      }
    }
  }
}

resource "azurerm_key_vault_access_policy" "infra_ci" {
  key_vault_id = data.azurerm_key_vault.weu_common.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.federated_identities.federated_ci_identity.id

  secret_permissions = [
    "Get",
  ]
}

resource "azurerm_key_vault_access_policy" "infra_cd" {
  key_vault_id = data.azurerm_key_vault.weu_common.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.federated_identities.federated_cd_identity.id

  secret_permissions = [
    "Get",
  ]
}
