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
