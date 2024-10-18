module "opex_federated_identities" {
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
        dashboards = [
          "Reader"
        ],
        terraform-state-rg = [
          "Storage Blob Data Reader",
          "Reader and Data Access"
        ]
      }
    }
  }

  continuos_delivery = {
    enable = true

    roles = {
      subscription = ["Reader"]
      resource_groups = {
        dashboards = [
          "Contributor"
        ],
        terraform-state-rg = [
          "Storage Blob Data Contributor",
          "Reader and Data Access"
        ]
      }
    }
  }

  tags = local.tags
}
