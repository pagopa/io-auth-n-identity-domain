#############################
# io-p-itn-auth-webprof-rg-01
#############################

resource "azurerm_role_assignment" "infra_cd_rg_webprof_contributor" {
  scope                = azurerm_resource_group.function_web_profile_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_user_assigned_identity.infra_cd_01.principal_id
  description          = "Allow Infra CD identity to apply changes to resources at resource group scope"
}

resource "azurerm_role_assignment" "admins_group_rg_webprof" {
  scope                = azurerm_resource_group.function_web_profile_rg.id
  role_definition_name = "Owner"
  principal_id         = data.azuread_group.auth_admins.object_id
  description          = "Allow AD Admin group the complete ownership at resource group scope"
}

resource "azurerm_role_assignment" "devs_group_rg_webprof" {
  scope                = azurerm_resource_group.function_web_profile_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_group.auth_devs.object_id
  description          = "Allow AD Dev group to apply changes at resource group scope"
}

##############################
# io-p-itn-auth-lollipop-rg-02
##############################

resource "azurerm_role_assignment" "infra_cd_rg_lollipop_contributor" {
  scope                = azurerm_resource_group.function_lollipop_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_user_assigned_identity.infra_cd_01.principal_id
  description          = "Allow Infra CD identity to apply changes to resources at resource group scope"
}

resource "azurerm_role_assignment" "admins_group_rg_lollipop" {
  scope                = azurerm_resource_group.function_lollipop_rg.id
  role_definition_name = "Owner"
  principal_id         = data.azuread_group.auth_admins.object_id
  description          = "Allow AD Admin group the complete ownership at resource group scope"
}

resource "azurerm_role_assignment" "devs_group_rg_lollipop" {
  scope                = azurerm_resource_group.function_lollipop_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_group.auth_devs.object_id
  description          = "Allow AD Dev group to apply changes at resource group scope"
}

########################
# io-p-itn-auth-lv-rg-01
########################

resource "azurerm_role_assignment" "infra_cd_rg_lv_contributor" {
  scope                = azurerm_resource_group.function_lv_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_user_assigned_identity.infra_cd_01.principal_id
  description          = "Allow Infra CD identity to apply changes to resources at resource group scope"
}

resource "azurerm_role_assignment" "admins_group_rg_lv" {
  scope                = azurerm_resource_group.function_lv_rg.id
  role_definition_name = "Owner"
  principal_id         = data.azuread_group.auth_admins.object_id
  description          = "Allow AD Admin group the complete ownership at resource group scope"
}

resource "azurerm_role_assignment" "devs_group_rg_lv" {
  scope                = azurerm_resource_group.function_lv_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_group.auth_devs.object_id
  description          = "Allow AD Dev group to apply changes at resource group scope"
}

############################
# io-p-itn-auth-public-rg-01
############################

resource "azurerm_role_assignment" "infra_cd_rg_public_contributor" {
  scope                = azurerm_resource_group.function_public_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_user_assigned_identity.infra_cd_01.principal_id
  description          = "Allow Infra CD identity to apply changes to resources at resource group scope"
}

resource "azurerm_role_assignment" "admins_group_rg_public" {
  scope                = azurerm_resource_group.function_public_rg.id
  role_definition_name = "Owner"
  principal_id         = data.azuread_group.auth_admins.object_id
  description          = "Allow AD Admin group the complete ownership at resource group scope"
}

resource "azurerm_role_assignment" "devs_group_rg_public" {
  scope                = azurerm_resource_group.function_public_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_group.auth_devs.object_id
  description          = "Allow AD Dev group to apply changes at resource group scope"
}

############################
# io-p-itn-auth-common-rg-01
############################

resource "azurerm_role_assignment" "infra_cd_rg_common_contributor" {
  scope                = azurerm_resource_group.auth_common_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_user_assigned_identity.infra_cd_01.principal_id
  description          = "Allow Infra CD identity to apply changes to resources at resource group scope"
}

resource "azurerm_role_assignment" "admins_group_rg_common" {
  scope                = azurerm_resource_group.auth_common_rg.id
  role_definition_name = "Owner"
  principal_id         = data.azuread_group.auth_admins.object_id
  description          = "Allow AD Admin group the complete ownership at resource group scope"
}

resource "azurerm_role_assignment" "devs_group_rg_common" {
  scope                = azurerm_resource_group.auth_common_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_group.auth_devs.object_id
  description          = "Allow AD Dev group to apply changes at resource group scope"
}

####################################
# io-p-itn-citizen-auth-shared-rg-01
####################################

resource "azurerm_role_assignment" "infra_cd_rg_shared_contributor" {
  scope                = azurerm_resource_group.shared_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_user_assigned_identity.infra_cd_01.principal_id
  description          = "Allow Infra CD identity to apply changes to resources at resource group scope"
}

resource "azurerm_role_assignment" "admins_group_rg_shared" {
  scope                = azurerm_resource_group.shared_rg.id
  role_definition_name = "Owner"
  principal_id         = data.azuread_group.auth_admins.object_id
  description          = "Allow AD Admin group the complete ownership at resource group scope"
}

resource "azurerm_role_assignment" "devs_group_rg_shared" {
  scope                = azurerm_resource_group.shared_rg.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_group.auth_devs.object_id
  description          = "Allow AD Dev group to apply changes at resource group scope"
}

#########################
# io-p-itn-auth-elt-rg-01
#########################

resource "azurerm_role_assignment" "infra_cd_rg_elt_contributor" {
  scope                = azurerm_resource_group.rg_elt .id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_user_assigned_identity.infra_cd_01.principal_id
  description          = "Allow Infra CD identity to apply changes to resources at resource group scope"
}

resource "azurerm_role_assignment" "admins_group_rg_elt" {
  scope                = azurerm_resource_group.rg_elt .id
  role_definition_name = "Owner"
  principal_id         = data.azuread_group.auth_admins.object_id
  description          = "Allow AD Admin group the complete ownership at resource group scope"
}

resource "azurerm_role_assignment" "devs_group_rg_elt" {
  scope                = azurerm_resource_group.rg_elt .id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_group.auth_devs.object_id
  description          = "Allow AD Dev group to apply changes at resource group scope"
}
