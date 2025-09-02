locals {
  session_manager_pool_name   = "session-manager-pool"
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

  session_manager_base_policy_zendesk_pool = <<XML
  <policies>
      <inbound>
          <base />
          <set-backend-service id="apim-pool-session-manager" backend-id="${local.session_manager_pool_name}" />
          <rewrite-uri template='@(context.Request.Url.Path)' />
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

# Remove when the backend pool is used in policies
resource "azurerm_api_management_backend" "session_manager" {
  title               = "Session Manager"
  name                = "session-manager-backend"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  protocol            = "http"
  url                 = var.session_manager_urls[0]
}

resource "azurerm_api_management_backend" "session_manager_backends" {
  count               = length(var.session_manager_urls)
  title               = "Session Manager ${count.index + 1}"
  name                = "session-manager-backend-${count.index + 1}"
  resource_group_name = var.platform_apim_resource_group_name
  api_management_name = var.platform_apim_name
  protocol            = "http"
  url                 = var.session_manager_urls[count.index]
}

resource "azapi_resource" "session_manager_pool" {
  type      = "Microsoft.ApiManagement/service/backends@2024-06-01-preview"
  name      = local.session_manager_pool_name
  parent_id = var.platform_apim_id
  body = {
    properties = {
      protocol    = null
      url         = null
      type        = "Pool"
      description = "Load Balancer of Session Manager"
      pool = {
        services = [
          {
            id = azurerm_api_management_backend.session_manager_backends[0].id
          },
          {
            id = azurerm_api_management_backend.session_manager_backends[1].id
          }
        ]
      }
    }
  }
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
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.2/apps/io-session-manager/api/sso/bpd.yaml"

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
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.2/apps/io-session-manager/api/external.yaml"

  xml_content = local.session_manager_base_policy
}

### REVISION 2
resource "azurerm_api_management_api" "external_api_session_manager_revision_2" {
  name                = "io-session-manager-external-api-v1"
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name

  version_set_id = azurerm_api_management_api_version_set.auth_v1.id
  version        = "v1"
  revision       = 2
  source_api_id  = module.external_api_session_manager.id
  display_name   = "IO SESSION MANAGER EXTERNAL API"
  path           = var.external_api_base_path
  protocols      = ["https"]
  description    = "Auth & Identity Session Manager External API"

  service_url           = "${azurerm_api_management_backend.session_manager.url}${var.external_api_base_path}/v1"
  subscription_required = false
}

resource "azurerm_api_management_api_operation_policy" "external_api_session_manager_rev2_login_policy" {
  api_management_name = var.platform_apim_name
  resource_group_name = var.platform_apim_resource_group_name
  api_name            = azurerm_api_management_api.external_api_session_manager_revision_2.name

  # Operation ID defined in the openapi spec
  operation_id = "login"
  xml_content  = <<XML
      <policies>
        <inbound>
          <base />
          <set-variable name="startMaintenanceTime" value="2025-09-04T04:00:00.000+00:00" />
          <set-variable name="endMaintenanceTime" value="2025-09-04T06:00:00.000+00:00" />

          <choose>
            <when condition="@(DateTime.UtcNow >= Convert.ToDateTime(context.Variables["startMaintenanceTime"]) && DateTime.UtcNow <= Convert.ToDateTime(context.Variables["endMaintenanceTime"]))">
              <return-response>
                <set-status code="500" reason="Ongoing Maintenance" />
              </return-response>
            </when>
          </choose>
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
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.2/apps/io-session-manager/api/sso/fims.yaml"

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
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.2/apps/io-session-manager/api/sso/pagopa.yaml"

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

  service_url = null

  subscription_required = false

  content_format = "openapi-link"
  content_value  = "https://raw.githubusercontent.com/pagopa/io-auth-n-identity-domain/refs/tags/io-session-manager%401.9.2/apps/io-session-manager/api/sso/zendesk.yaml"

  xml_content = local.session_manager_base_policy_zendesk_pool
}

resource "azurerm_api_management_api_tag" "zendesk_api_tag" {
  api_id = module.zendesk_api_session_manager.id
  name   = azurerm_api_management_tag.session_manager_tag.name
}
