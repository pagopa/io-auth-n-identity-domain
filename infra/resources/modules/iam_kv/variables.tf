variable "principal_ids" {
  type        = set(string)
  description = "List of principal IDs to which the role will be assigned."
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
