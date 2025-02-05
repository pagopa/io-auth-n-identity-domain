output "subscription_primary_key" {
  value =  azurerm_api_management_subscription.auth_n_identity_operation.primary_key
  sensitive = true
}

output "subscription_secondary_key" {
  value =  azurerm_api_management_subscription.auth_n_identity_operation.secondary_key
  sensitive = true
}
