variable "tags" {
  type = map(string)
}

variable "storage_account" {
  type = object({
    id   = string
    name = string
  })
  description = "Details of the target Storage Account"
}

variable "containers" {
  type        = set(string)
  default     = []
  description = "List container names"
}

variable "encryption_scopes" {
  type        = map(string)
  default     = {}
  description = <<EOT
  A map of string containing the container name as key and the name of the encryption scope as value.
  The name of the container must be set also in the `containers` variable, otherwise it will be ignored
  EOT
}

variable "immutability_policies" {
  type        = map(string)
  default     = {}
  description = <<EOT
  "A map of string containing the name of containers that should have an immutability policies applied.
  The map should have the container name as key and the number of days as value (e.g. `{ "container_name" = "10" }`).
  The name of the container must be set also in the `containers` variable, otherwise it will be ignored
  EOT
}

variable "queues" {
  type        = set(string)
  default     = []
  description = "List of queue names"
}

variable "tables" {
  type        = set(string)
  default     = []
  description = "List of table names"
}
