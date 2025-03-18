import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-citizen-auth-data-rg"
  to = azurerm_resource_group.data_weu
}

resource "azurerm_resource_group" "data_weu" {
  name     = "${local.prefix}-${local.env_short}-citizen-auth-data-rg"
  location = "westeurope"

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-citizen-auth-sec-rg"
  to = azurerm_resource_group.sec_weu
}

resource "azurerm_resource_group" "sec_weu" {
  name     = "${local.prefix}-${local.env_short}-citizen-auth-sec-rg"
  location = "westeurope"

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-common-rg-01"
  to = azurerm_resource_group.common_itn_01
}

resource "azurerm_resource_group" "common_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-common-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-elt-rg-01"
  to = azurerm_resource_group.elt_itn_01
}

resource "azurerm_resource_group" "elt_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-elt-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-lollipop-rg-02"
  to = azurerm_resource_group.lollipop_itn_02
}

resource "azurerm_resource_group" "lollipop_itn_02" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-lollipop-rg-02"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-lv-rg-01"
  to = azurerm_resource_group.lv_itn_01
}

resource "azurerm_resource_group" "lv_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-lv-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-main-rg-01"
  to = azurerm_resource_group.main_itn_01
}

resource "azurerm_resource_group" "main_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-main-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-public-rg-01"
  to = azurerm_resource_group.public_itn_01
}

resource "azurerm_resource_group" "public_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-public-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-rg-01"
  to = azurerm_resource_group.auth_itn_01
}

resource "azurerm_resource_group" "auth_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-auth-webprof-rg-01"
  to = azurerm_resource_group.webprof_itn_01
}

resource "azurerm_resource_group" "webprof_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-auth-webprof-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-citizen-auth-data-rg-01"
  to = azurerm_resource_group.data_itn_01
}

resource "azurerm_resource_group" "data_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-citizen-auth-data-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-profile-rg-01"
  to = azurerm_resource_group.profile_itn_01
}

resource "azurerm_resource_group" "profile_itn_01" {
  name     = "${local.prefix}-${local.env_short}-itn-profile-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-weu-session-manager-rg-01"
  to = azurerm_resource_group.session_manager_weu_01
}

resource "azurerm_resource_group" "session_manager_weu_01" {
  name     = "${local.prefix}-${local.env_short}-weu-session-manager-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-profile-rg-01"
  to = azurerm_resource_group.func_profile_itn
}

resource "azurerm_resource_group" "func_profile_itn" {
  name     = "${local.prefix}-${local.env_short}-itn-profile-rg-01"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-citizen-auth-data-rg"
  to = azurerm_resource_group.auth_data
}

resource "azurerm_resource_group" "auth_data" {
  name     = "${local.prefix}-${local.env_short}-citizen-auth-data-rg"
  location = local.location

  tags = local.tags
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-citizen-auth-shared-rg-01"
  to = azurerm_resource_group.shared_itn_01
}

resource "azurerm_resource_group" "shared_itn_01" {
  name     = "${local.prefix}-${local.env_short}-citizen-auth-shared-rg-01"
  location = local.location

  tags = local.tags
}

