resource "azurerm_resource_group" "data_weu" {
  name     = "${local.prefix}-${local.env_short}-citizen-auth-data-rg"
  location = "westeurope"

  tags = local.tags
}

resource "azurerm_resource_group" "sec_weu" {
  name     = "${local.prefix}-${local.env_short}-citizen-auth-sec-rg"
  location = "westeurope"

  tags = local.tags
}

resource "azurerm_resource_group" "common_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-common-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "elt_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-elt-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "lollipop_itn_02" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-lollipop-rg-02"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "lv_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-lv-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "main_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-main-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "public_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-public-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "auth_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "webprof_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-webprof-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "data_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-citizen-auth-data-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "session_manager_weu_01" {
  name     = "${local.prefix}-${local.env_short}-weu-session-manager-rg-01"
  location = "westeurope"

  tags = local.tags
}

resource "azurerm_resource_group" "shared_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-citizen-auth-shared-rg-01"
  location = local.location

  tags = local.tags
}

resource "azurerm_resource_group" "ioweb_common_weu" {
  name     = "${local.prefix}-${local.env_short}-weu-ioweb-common-rg"
  location = "westeurope"

  tags = local.tags
}

resource "azurerm_resource_group" "storage_weu" {
  name     = "${local.prefix}-${local.env_short}-weu-ioweb-storage-rg"
  location = "westeurope"

  tags = local.tags
}
