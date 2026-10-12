

data "azurerm_storage_account" "io_com" {
  name                = "iopitncomst01"
  resource_group_name = "io-p-itn-com-rg-01"
}

data "azurerm_storage_queue" "push_notifications" {
  name               = "push-notifications"
  storage_account_id = data.azurerm_storage_account.io_com.id
}

# External DNS zone backing the public IO API hostname, used to build
# LOGIN_SUCCESS_REDIRECT_URL (mirrors io-infra's BACKEND_HOST).
data "azurerm_resource_group" "rg_external" {
  name = "${var.prefix}-${var.env_short}-rg-external"
}

data "azurerm_dns_zone" "io_pagopa_it" {
  name                = "io.pagopa.it"
  resource_group_name = data.azurerm_resource_group.rg_external.name
}

data "azurerm_dns_a_record" "api_app_io_pagopa_it" {
  name                = "api-app"
  zone_name           = data.azurerm_dns_zone.io_pagopa_it.name
  resource_group_name = data.azurerm_resource_group.rg_external.name
}
