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

variable "session_manager_urls" {
  type        = list(string)
  description = "List of URLs of session manager app services where to redirect requests"
}

variable "bpd_api_base_path" {
  type        = string
  description = "Base path for API"
}

variable "external_api_base_path" {
  type        = string
  description = "Base path for API"
}

variable "fims_api_base_path" {
  type        = string
  description = "Base path for API"
}

variable "pagopa_api_base_path" {
  type        = string
  description = "Base path for API"
}

variable "zendesk_api_base_path" {
  type        = string
  description = "Base path for API"
}
