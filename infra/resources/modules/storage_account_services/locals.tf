locals {
  metadata = {
    for key, value in var.tags :
    lower(key) => value
  }
}
