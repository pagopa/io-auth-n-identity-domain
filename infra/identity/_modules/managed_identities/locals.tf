locals {
  prefix = "dx"

  ci_github_federations = [
    {
      repository = "dx-typescript",
      subject    = "prod-ci"
    }
  ]

  cd_github_federations = [
    {
      repository = "dx-typescript",
      subject    = "prod-cd"
    }
  ]

  environment_ci_roles = {
    subscription = [
      "Reader",
      "Reader and Data Access"
    ]
    resource_groups = {
      terraform-state-rg = [
        "Storage Blob Data Contributor"
      ]
    }
  }

  environment_cd_roles = {
    subscription = [
      "Contributor"
    ]
    resource_groups = {
      terraform-state-rg = [
        "Storage Blob Data Contributor"
      ]
    }
  }
}