locals {
  bff_backend_url = "https://%s/api/v1"
  product         = "${var.prefix}-${var.env_short}"
}