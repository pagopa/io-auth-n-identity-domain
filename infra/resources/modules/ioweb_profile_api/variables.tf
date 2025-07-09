######################
#  Common Variables  #
######################

variable "prefix" {
  type    = string
  default = "io"
  validation {
    condition = (
      length(var.prefix) < 6
    )
    error_message = "Max length is 6 chars."
  }
}

variable "env_short" {
  type = string
  validation {
    condition = (
      length(var.env_short) <= 1
    )
    error_message = "Max length is 1 chars."
  }
}


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

####################
#  io-web-profile  #
####################


variable "function_web_profile_hostname" {
  type        = string
  description = "Hostname of io-web-profile-backend"
}

variable "function_web_profile_basepath" {
  type        = string
  description = "Base path of io-web-profile-backend"
}


