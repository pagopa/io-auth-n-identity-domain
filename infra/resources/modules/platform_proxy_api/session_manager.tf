locals {
  session_manager_base_policy = <<XML
  <policies>
      <inbound>
        <base />
      </inbound>
      <backend>
          <base />
      </backend>
      <outbound>
          <base />
      </outbound>
      <on-error>
          <base />
      </on-error>
  </policies>
  XML
}

resource "azurerm_api_management_backend" "session_manager" {
  title               = "Session Manager"
  name                = "session-manager-backend"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  protocol            = "http"
  url                 = var.session_manager_url
}

resource "azurerm_api_management_tag" "session_manager_tag" {
  api_management_id = var.platform_apim_id
  name              = "Auth-Session-Manager"
}

##################
#      BPD       #
##################
resource "azurerm_api_management_api_version_set" "bpd_v1" {
  name                = "bpd_v1"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "Auth & Identity bpd v1"
  versioning_scheme   = "Segment"
}

module "bpd_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.16.0"

  name                = "io-session-manager-bpd-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "IO SESSION MANAGER BPD API"
  description         = "Auth & Identity Session Manager BPD API"

  version_set_id = azurerm_api_management_api_version_set.bpd_v1.id
  api_version    = "v1"
  revision       = 1
  path           = var.bpd_api_base_path
  protocols      = ["https"]
  product_ids    = [data.azurerm_api_management_product.apim_platform_domain_product.product_id]

  service_url = "${azurerm_api_management_backend.session_manager.url}${var.bpd_api_base_path}/v1"

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.0/apps/io-session-manager/api/sso/bpd.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "bpd_api_tag" {
  api_id = module.bpd_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}


##################
#    EXTERNAL    #
##################
resource "azurerm_api_management_api_version_set" "auth_v1" {
  name                = "io_auth_v1"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "Auth & Identity auth v1"
  versioning_scheme   = "Segment"
}

module "external_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.16.0"

  name                = "io-session-manager-external-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "IO SESSION MANAGER EXTERNAL API"
  description         = "Auth & Identity Session Manager External API"

  version_set_id = azurerm_api_management_api_version_set.auth_v1.id
  api_version    = "v1"
  revision       = 1
  path           = var.external_api_base_path
  protocols      = ["https"]
  product_ids    = [data.azurerm_api_management_product.apim_platform_domain_product.product_id]

  service_url = "${azurerm_api_management_backend.session_manager.url}${var.external_api_base_path}/v1"

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.0/apps/io-session-manager/api/external.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "external_api_tag" {
  api_id = module.external_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}


##################
#      FIMS      #
##################
resource "azurerm_api_management_api_version_set" "fims_v1" {
  name                = "fims_v1"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "Auth & Identity FIMS v1"
  versioning_scheme   = "Segment"
}
module "fims_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.16.0"

  name                = "io-session-manager-fims-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "IO SESSION MANAGER FIMS API"
  description         = "Auth & Identity Session Manager Fims API"

  version_set_id = azurerm_api_management_api_version_set.fims_v1.id
  api_version    = "v1"
  revision       = 1
  path           = var.fims_api_base_path
  protocols      = ["https"]
  product_ids    = [data.azurerm_api_management_product.apim_platform_domain_product.product_id]

  service_url = "${azurerm_api_management_backend.session_manager.url}${var.fims_api_base_path}/v1"

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.0/apps/io-session-manager/api/sso/fims.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "fims_api_tag" {
  api_id = module.fims_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

##################
#     PAGOPA     #
##################
resource "azurerm_api_management_api_version_set" "pagopa_v1" {
  name                = "pagopa_v1"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "Auth & Identity Pagopa v1"
  versioning_scheme   = "Segment"
}
module "pagopa_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.16.0"

  name                = "io-session-manager-pagopa-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "IO SESSION MANAGER PAGOPA API"
  description         = "Auth & Identity Session Manager Pagopa API"

  version_set_id = azurerm_api_management_api_version_set.pagopa_v1.id
  api_version    = "v1"
  revision       = 1
  path           = var.pagopa_api_base_path
  protocols      = ["https"]
  product_ids    = [data.azurerm_api_management_product.apim_platform_domain_product.product_id]

  service_url = "${azurerm_api_management_backend.session_manager.url}${var.pagopa_api_base_path}/v1"

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.0/apps/io-session-manager/api/sso/pagopa.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "pagopa_api_tag" {
  api_id = module.pagopa_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

##################
#     ZENDESK    #
##################
resource "azurerm_api_management_api_version_set" "zendesk_v1" {
  name                = "zendesk_v1"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "Auth & Identity Zendesk v1"
  versioning_scheme   = "Segment"
}
module "zendesk_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v4//api_management_api?ref=v7.16.0"

  name                = "io-session-manager-zendesk-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "IO SESSION MANAGER ZENDESK API"
  description         = "Auth & Identity Session Manager Zendesk API"

  version_set_id = azurerm_api_management_api_version_set.zendesk_v1.id
  api_version    = "v1"
  revision       = 1
  path           = var.zendesk_api_base_path
  protocols      = ["https"]
  product_ids    = [data.azurerm_api_management_product.apim_platform_domain_product.product_id]

  service_url = "${azurerm_api_management_backend.session_manager.url}${var.zendesk_api_base_path}/v1"

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.0/apps/io-session-manager/api/sso/zendesk.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "zendesk_api_tag" {
  api_id = module.zendesk_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}
