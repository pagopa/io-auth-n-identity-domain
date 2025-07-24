variable "function_apps_principal_ids" {
  type        = map(string)
  description = "Map of Function App principal IDs to give secret access as reader"
  default     = {}
}

variable "storage_account_principal_ids" {
  type        = map(string)
  description = "Map of Storage Account principal IDs to give crypto access as writer"
  default     = {}
}

variable "key_vault" {
  type = object({
    name                = string
    resource_group_name = string
  })
  description = "Details of the Key Vault to which the role will be applied"
}

variable "subscription_id" {
  type        = string
  description = "Id of the subscription where the Key Vault is located"
}
