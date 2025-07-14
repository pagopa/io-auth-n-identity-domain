variable "tags" {
  type = map(string)
}

variable "resource_group_name" {
  type = string
}

variable "tenant_id" {
  type = string
}

variable "environment" {
  type = object({
    prefix      = string,
    environment = string,
    location    = string,
  })

  description = "Values which are used to generate resource names and location short names. They are all mandatory except for domain, which should not be used only in the case of a resource used by multiple domains."
}
