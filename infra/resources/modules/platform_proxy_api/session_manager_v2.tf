##################
#    EXTERNAL    #
##################
resource "azurerm_api_management_api" "external_api_session_manager_v2" {
  name                  = "io-session-manager-external-api-v2"
  api_management_name   = var.platform_apim_name
  resource_group_name   = var.platform_apim_resource_group_name
  subscription_required = false

  version_set_id = azurerm_api_management_api_version_set.auth_v1.id
  version        = "v2"
  revision       = 1

  description  = "Auth & Identity Session Manager External API with OI integration"
  display_name = "IO SESSION MANAGER OI EXTERNAL API"
  path         = var.external_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.external_api_base_path}/v2"

  import {
    content_format = "openapi-link"
    content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/55db1f15411a839f5d50848961f23a951f638a5a/apps/io-session-manager-oi/api/external.yaml"

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

  description  = "Auth & Identity Session Manager BPD API with OI integration"
  display_name = "IO SESSION MANAGER OI BPD API"
  path         = var.bpd_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.bpd_api_base_path}/v2"

  import {
    content_format = "openapi-link"
    content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/9b64e4db4341e8b0d2fd68a902917c12df5576d1/apps/io-session-manager-oi/api/sso/bpd.yaml"

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

  description  = "Auth & Identity Session Manager FIMS API with OI integration"
  display_name = "IO SESSION MANAGER OI FIMS API"
  path         = var.fims_api_base_path
  protocols    = ["https"]
  service_url  = "${var.session_manager_oi_url}/${var.fims_api_base_path}/v2"

  import {
    content_format = "openapi-link"
    content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/5ec54767cbea92a8099977e86c1fc1434bde70eb/apps/io-session-manager-oi/api/sso/fims.yaml"

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
