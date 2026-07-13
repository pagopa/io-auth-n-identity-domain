# # not sure it is required (why cae have to access to kv?!)
# module "cae_iam" {
#   source  = "pagopa-dx/azure-role-assignments/azurerm"
#   version = "~> 1.3"

#   subscription_id = var.subscription_id
#   principal_id    = module.sm_cae.principal_id

#   key_vault = [{
#     name                = var.key_vault.name
#     resource_group_name = var.key_vault.resource_group_name
#     description         = "Allow CAE to read configuration secrets"
#     roles = {
#       secrets = "reader"
#     }
#   }]
# }

module "ca_iam" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 1.3"

  subscription_id = var.subscription_id
  principal_id    = module.sm_ca.principal_id

  key_vault = [{
    name                = var.key_vault.name
    resource_group_name = var.key_vault.resource_group_name
    description         = "Allow Session Manager Container App to read secrets"
    roles = {
      secrets = "reader"
    }
  }]

  # cosmos = [ # TODO: capire su quali DB necessita scrittura/lettura
  #   {
  #     account_name        = data.azurerm_cosmosdb_account.cosmos.name
  #     resource_group_name = data.azurerm_cosmosdb_account.cosmos.resource_group_name
  #     description         = "Allow Session Manager Container App to write CosmosDB"
  #     role                = "writer"
  #     database            = local.app_be.cosmosdb_name
  #     collections         = ["services"] // TODO: refactor with a local variable
  #   }
  # ]
}
