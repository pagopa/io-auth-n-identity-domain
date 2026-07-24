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

variable "location" {
  type        = string
  description = "Azure region"
}

variable "location_short" {
  type        = string
  description = "Azure region"
}

variable "domain" {
  type        = string
  description = "Domain name of the application"
}

variable "tags" {
  type        = map(any)
  description = "Resource tags"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group name for the Function App services"
}

variable "subscription_id" {
  type        = string
  description = "Azure subscription ID"
}


################
#  Networking  #
################

variable "virtual_network_id" {
  type        = string
  description = "Virtual network to which the services will be connected"
}

variable "private_dns_zone_resource_group_name" {
  type        = string
  description = "The resource group containing the Private DNS Zone for private endpoints"
}


##############
# Monitoring #
##############

variable "log_analytics_workspace_id" {
  type        = string
  description = "Log Analytics Workspace ID for monitoring"
}


##############
# Key Vaults #
##############

variable "key_vault" {
  type = object({
    id                  = string
    name                = string
    resource_group_name = string
  })
  description = "Key Vault for storing secrets"
}


variable "lollipop" {
  type = object({
    base_url  = string
    base_path = string
  })
  description = "Configuration for Lollipop service"
}

variable "io_profile" {
  type = object({
    base_url  = string
    base_path = string
  })
  description = "Configuration for IO Profile service"
}

variable "io_session_manager_internal" {
  type = object({
    base_url  = string
    base_path = string
  })
  description = "Configuration for IO Session Manager Internal service"
}
