##########
#  APIM  #
##########

variable "apim_name" {
  type        = string
  description = "APIM Resource name"
}

variable "apim_resource_group_name" {
  type        = string
  description = "APIM Resource group name"
}

variable "key_vault_common_id" {
  type        = string
  description = "ID of the common key vault"
}

variable "api_host_name" {
  type        = string
  description = "Host to use in Swagger files"
}

variable "function_profile_url" {
  type        = string
  description = "Function Profile URL"
}

variable "function_admin_url" {
  type        = string
  description = "Function Admin URL"
}

variable "operation_subscription_primary_key" {
  type        = string
  sensitive   = true
  description = "(Optional) A primary subscription key for the APIM user. If not provided, it will be randomly generated"
  default     = null
}

variable "operation_subscription_secondary_key" {
  type        = string
  sensitive   = true
  description = "(Optional) A secondary subscription key for the APIM user. If not provided, it will be randomly generated"
  default     = null
}
