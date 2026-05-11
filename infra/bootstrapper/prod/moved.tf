moved {
  from = module.repo.azurerm_key_vault_access_policy.infra_ci_kv_common["/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-common/providers/Microsoft.KeyVault/vaults/io-p-kv-common"]
  to   = azurerm_key_vault_access_policy.infra_ci_kv_common["/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-common/providers/Microsoft.KeyVault/vaults/io-p-kv-common"]
}

moved {
  from = module.repo.azurerm_key_vault_access_policy.infra_cd_kv_common["/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-common/providers/Microsoft.KeyVault/vaults/io-p-kv-common"]
  to   = azurerm_key_vault_access_policy.infra_cd_kv_common["/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-common/providers/Microsoft.KeyVault/vaults/io-p-kv-common"]
}
