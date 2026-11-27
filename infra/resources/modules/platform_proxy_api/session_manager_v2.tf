##################
#    EXTERNAL    #
##################

locals {
  external_api_session_manager_v2_openapi    = yamldecode(data.http.external_api_session_manager_v2_openapi.response_body)
  sso_bpd_api_session_manager_v2_openapi     = yamldecode(data.http.sso_bpd_api_session_manager_v2_openapi.response_body)
  sso_fims_api_session_manager_v2_openapi    = yamldecode(data.http.sso_fims_api_session_manager_v2_openapi.response_body)
  sso_pagopa_api_session_manager_v2_openapi  = yamldecode(data.http.sso_pagopa_api_session_manager_v2_openapi.response_body)
  sso_zendesk_api_session_manager_v2_openapi = yamldecode(data.http.sso_zendesk_api_session_manager_v2_openapi.response_body)
}

resource "azurerm_api_management_api" "external_api_session_manager_v2" {
  name                  = "io-session-manager-external-api-v2"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.auth_v1.id
  version        = "v2"
  revision       = 1

  description  = local.external_api_session_manager_v2_openapi.info.description
  display_name = local.external_api_session_manager_v2_openapi.info.title
  path         = var.external_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.external_api_base_path}/v2"

  import {
    content_format = "openapi"
    content_value  = data.http.external_api_session_manager_v2_openapi.response_body
  }
}

resource "azurerm_api_management_product_api" "external_api_session_manager_v2" {
  api_name            = azurerm_api_management_api.external_api_session_manager_v2.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  product_id          = data.azurerm_api_management_product.apim_platform_domain_product.product_id
}

resource "azurerm_api_management_api_tag" "external_api_session_manager_v2" {
  api_id = azurerm_api_management_api.external_api_session_manager_v2.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

resource "azurerm_api_management_api_operation_policy" "routing_based_on_token_version" {
  for_each = toset(["getUserIdentity", "getSession", "logout"])

  api_name            = azurerm_api_management_api.external_api_session_manager_v2.name
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name
  operation_id        = each.key

  xml_content = file("${path.module}/policies/session_manager_v2/routing_based_on_token_version_policy.xml")
}


##################
#      BPD       #
##################
resource "azurerm_api_management_api" "bpd_api_session_manager_v2" {
  name                  = "io-session-manager-bpd-api-v2"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.bpd_v1.id
  version        = "v2"
  revision       = 1

  description  = local.sso_bpd_api_session_manager_v2_openapi.info.description
  display_name = local.sso_bpd_api_session_manager_v2_openapi.info.title
  path         = var.bpd_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.bpd_api_base_path}/v2"

  import {
    content_format = "openapi"
    content_value  = data.http.sso_bpd_api_session_manager_v2_openapi.response_body
  }
}

resource "azurerm_api_management_product_api" "bpd_api_session_manager_v2" {
  api_name            = azurerm_api_management_api.bpd_api_session_manager_v2.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  product_id          = data.azurerm_api_management_product.apim_platform_domain_product.product_id
}

resource "azurerm_api_management_api_tag" "bpd_api_session_manager_v2" {
  api_id = azurerm_api_management_api.bpd_api_session_manager_v2.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

resource "azurerm_api_management_api_policy" "bpd_routing_based_on_token_version" {
  api_name            = azurerm_api_management_api.bpd_api_session_manager_v2.name
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name

  xml_content = file("${path.module}/policies/session_manager_v2/routing_based_on_token_version_policy.xml")
}


##################
#      FIMS      #
##################
resource "azurerm_api_management_api" "fims_api_session_manager_v2" {
  name                  = "io-session-manager-fims-api-v2"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.fims_v1.id
  version        = "v2"
  revision       = 1

  description  = local.sso_fims_api_session_manager_v2_openapi.info.description
  display_name = local.sso_fims_api_session_manager_v2_openapi.info.title
  path         = var.fims_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.fims_api_base_path}/v2"

  import {
    content_format = "openapi"
    content_value  = data.http.sso_fims_api_session_manager_v2_openapi.response_body
  }
}

resource "azurerm_api_management_product_api" "fims_api_session_manager_v2" {
  api_name            = azurerm_api_management_api.fims_api_session_manager_v2.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  product_id          = data.azurerm_api_management_product.apim_platform_domain_product.product_id
}

resource "azurerm_api_management_api_tag" "fims_api_session_manager_v2" {
  api_id = azurerm_api_management_api.fims_api_session_manager_v2.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

resource "azurerm_api_management_api_policy" "fims_routing_based_on_token_version" {
  api_name            = azurerm_api_management_api.fims_api_session_manager_v2.name
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name

  xml_content = file("${path.module}/policies/session_manager_v2/routing_based_on_token_version_policy.xml")
}


##################
#     PAGOPA     #
##################
resource "azurerm_api_management_api" "pagopa_api_session_manager_v2" {
  name                  = "io-session-manager-pagopa-api-v2"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.pagopa_v1.id
  version        = "v2"
  revision       = 1

  description  = local.sso_pagopa_api_session_manager_v2_openapi.info.description
  display_name = local.sso_pagopa_api_session_manager_v2_openapi.info.title
  path         = var.pagopa_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.pagopa_api_base_path}/v2"

  import {
    content_format = "openapi"
    content_value  = data.http.sso_pagopa_api_session_manager_v2_openapi.response_body

  }
}

resource "azurerm_api_management_product_api" "pagopa_api_session_manager_v2" {
  api_name            = azurerm_api_management_api.pagopa_api_session_manager_v2.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  product_id          = data.azurerm_api_management_product.apim_platform_domain_product.product_id
}

resource "azurerm_api_management_api_tag" "pagopa_api_session_manager_v2" {
  api_id = azurerm_api_management_api.pagopa_api_session_manager_v2.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

resource "azurerm_api_management_api_policy" "pagopa_routing_based_on_token_version" {
  api_name            = azurerm_api_management_api.pagopa_api_session_manager_v2.name
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name

  xml_content = file("${path.module}/policies/session_manager_v2/routing_based_on_token_version_policy.xml")
}


##################
#    ZENDESK     #
##################
resource "azurerm_api_management_api" "zendesk_api_session_manager_v2" {
  name                  = "io-session-manager-zendesk-api-v2"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  description  = local.sso_zendesk_api_session_manager_v2_openapi.info.description
  display_name = local.sso_zendesk_api_session_manager_v2_openapi.info.title

  version_set_id = azurerm_api_management_api_version_set.zendesk_v1.id
  version        = "v2"
  revision       = 1

  path        = var.zendesk_api_base_path
  protocols   = ["https"]
  service_url = "${var.session_manager_oi_url}/${var.zendesk_api_base_path}/v2"

  import {
    content_format = "openapi"
    content_value  = data.http.sso_zendesk_api_session_manager_v2_openapi.response_body
  }
}

resource "azurerm_api_management_product_api" "zendesk_api_session_manager_v2" {
  api_name            = azurerm_api_management_api.zendesk_api_session_manager_v2.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  product_id          = data.azurerm_api_management_product.apim_platform_domain_product.product_id
}

resource "azurerm_api_management_api_tag" "zendesk_api_session_manager_v2" {
  api_id = azurerm_api_management_api.zendesk_api_session_manager_v2.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

resource "azurerm_api_management_api_policy" "zendesk_routing_based_on_token_version" {
  api_name            = azurerm_api_management_api.zendesk_api_session_manager_v2.name
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name

  xml_content = file("${path.module}/policies/session_manager_v2/zendesk_routing_based_on_token_version_policy.xml")
}
