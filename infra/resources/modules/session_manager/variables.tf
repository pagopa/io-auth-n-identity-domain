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
  default     = null
}


##############
# Monitoring #
##############

variable "log_analytics_workspace_id" {
  type        = string
  description = "Log Analytics Workspace ID for monitoring"
}

variable "action_group_id" {
  type        = string
  description = "The ID of the Action Group to invoke when an alert is triggered"
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

variable "io_fast_login" {
  type = object({
    base_url  = string
    base_path = string
  })
  description = "Configuration for IO Fast Login service"
}

variable "locked_profiles" {
  type = object({
    storage_account = object({
      name                = string
      resource_group_name = string
    })
    table_name = string
  })
  description = "Azure Table Storage backing the locked profiles feature."
}

variable "io_session_manager_internal" {
  type = object({
    base_url  = string
    base_path = string
  })
  description = "Configuration for IO Session Manager Internal service"
}

variable "session_cosmos" {
  type = object({
    account_uri         = string
    account_name        = string
    resource_group_name = string
  })
  description = "Cosmos DB (io-auth-SM) accessed by the Session Manager Container App via managed identity"
}

variable "service_bus" {
  type = object({
    hostname                = string
    namespace_name          = string
    resource_group_name     = string
    auth_session_topic_name = string
  })
  description = "Service Bus configuration for the Session Manager Container App"
}
