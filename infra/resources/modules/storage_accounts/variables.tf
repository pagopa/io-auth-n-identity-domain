variable "tags" {
  type = map(string)
}

variable "resource_group_name" {
  type = string
}

variable "audit_resource_group_name" {
  type = string
}

variable "environment" {
  type = object({
    prefix    = string,
    env_short = string,
    location  = string,
    domain    = optional(string, "auth")
  })

  description = "Values which are used to generate resource names and location short names. They are all mandatory except for domain, which should not be used only in the case of a resource used by multiple domains."
}

variable "private_dns_zone_resource_group_name" {
  type = string
}

variable "subnet_pep_id" {
  type = string
}
