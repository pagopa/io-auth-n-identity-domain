# Azure AD
data "azuread_group" "adgroup_admin" {
  display_name = format("%s-adgroup-admin", local.common_project)
}