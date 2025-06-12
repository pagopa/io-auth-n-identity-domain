##########
#  APIM  #
##########

variable "platform_apim_name" {
  type        = string
  description = "APIM Resource name"
}

variable "platform_apim_id" {
  type        = string
  description = "APIM Resource ID"
}

variable "platform_apim_resource_group_name" {
  type        = string
  description = "APIM Resource group name"
}

variable "session_manager_url" {
  type        = string
  description = "URL of session manager app service where to redirect requests"
}

variable "session_manager_prefix" {
  type        = string
  description = "Prefix for session manager requests, stripped later on the policy"
}

variable "bpd_api_base_path" {
  type        = string
  description = "Base path for API"
}

variable "fast_login_api_base_path" {
  type        = string
  description = "Base path for API"
}

variable "fims_api_base_path" {
  type        = string
  description = "Base path for API"
}

# variable "internal_api_base_path" {
#   type        = string
#   description = "Base path for API"
# }

variable "pagopa_api_base_path" {
  type        = string
  description = "Base path for API"
}

# variable "public_api_base_path" {
#   type        = string
#   description = "Base path for API"
# }

variable "token_introspection_api_base_path" {
  type        = string
  description = "Base path for API"
}

variable "zendesk_api_base_path" {
  type        = string
  description = "Base path for API"
}
