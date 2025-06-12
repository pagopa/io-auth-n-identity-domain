locals {
  session_manager_base_policy = <<XML
  <policies>
      <inbound>
        <base />
        <rewrite-uri template="@(context.Request.OriginalUrl.Path.Replace("${var.session_manager_prefix}", ""))" />
        <set-backend-service id="session-manager-public-url" backend-id="${azurerm_api_management_backend.session_manager.id}">
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

resource "azurerm_api_management_group" "api_session_manager_group" {
  name                = "apisessionmanager"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  display_name        = "ApiSessionManager"
  description         = "A group representing session manager API"
}

resource "azurerm_api_management_backend" "session_manager" {
  title               = "Session Manager"
  name                = "session-manager-backend"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  protocol            = "http"
  url                 = var.session_manager_url
}

resource "azurerm_api_management_product_group" "session_manager_group_association" {
  product_id          = module.apim_platform_product_domain.product_id
  group_name          = azurerm_api_management_group.api_session_manager_group.name
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
}

resource "azurerm_api_management_tag" "session_manager_tag" {
  api_management_id = var.platform_apim_id
  name              = "Auth-Session-Manager"
}

module "bpd_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-bpd-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER BPD API"
  description         = "Auth & Identity Session Manager BPD API"

  path        = "${var.session_manager_prefix}/${var.bpd_api_base_path}"
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/bpd.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "bpd_api_tag" {
  api_id = module.bpd_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

module "fast_login_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-fast-login-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER FAST LOGIN API"
  description         = "Auth & Identity Session Manager Fast Login API"

  path        = "${var.session_manager_prefix}/${var.fast_login_api_base_path}"
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/fast-login.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "fast_login_api_tag" {
  api_id = module.fast_login_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

module "fims_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-fims-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER FIMS API"
  description         = "Auth & Identity Session Manager Fims API"

  path        = "${var.session_manager_prefix}/${var.fims_api_base_path}"
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/fims.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "fims_api_tag" {
  api_id = module.fims_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

module "internal_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-internal-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER INTERNAL API"
  description         = "Auth & Identity Session Manager Internal API"

  path        = var.session_manager_prefix
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/internal.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "internal_api_tag" {
  api_id = module.internal_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

module "pagopa_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-pagopa-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER PAGOPA API"
  description         = "Auth & Identity Session Manager Pagopa API"

  path        = "${var.session_manager_prefix}/${var.pagopa_api_base_path}"
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/pagopa.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "pagopa_api_tag" {
  api_id = module.pagopa_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

module "public_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-public-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER PUBLIC API"
  description         = "Auth & Identity Session Manager Public API"

  path        = var.session_manager_prefix
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/public.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "public_api_tag" {
  api_id = module.public_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

module "token_introspection_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-token-introspection-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER TOKEN INTROSPECTION API"
  description         = "Auth & Identity Session Manager Token Introspection API"

  path        = "${var.session_manager_prefix}/${var.token_introspection_api_base_path}"
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/token_introspection.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "token_introspection_api_tag" {
  api_id = module.token_introspection_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}

module "zendesk_api_session_manager" {
  source = "github.com/pagopa/terraform-azurerm-v3//api_management_api?ref=v8.27.0"

  name                = "io-session-manager-zendesk-api"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  revision            = "1"
  display_name        = "IO SESSION MANAGER ZENDESK API"
  description         = "Auth & Identity Session Manager Zendesk API"

  path        = "${var.session_manager_prefix}/${var.zendesk_api_base_path}"
  protocols   = ["https"]
  product_ids = [module.apim_platform_product_domain.product_id]

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/%40pagopa/io-session-manager%400.16.1/apps/session-manager/api/zendesk.yaml"

  xml_content = local.session_manager_base_policy
}

resource "azurerm_api_management_api_tag" "zendesk_api_tag" {
  api_id = module.zendesk_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}
