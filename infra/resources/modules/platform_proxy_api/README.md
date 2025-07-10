# platform_api

<!-- BEGIN_TF_DOCS -->
## Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | 3.117.1 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_bpd_api_session_manager"></a> [bpd\_api\_session\_manager](#module\_bpd\_api\_session\_manager) | github.com/pagopa/terraform-azurerm-v3//api_management_api | v8.27.0 |
| <a name="module_external_api_session_manager"></a> [external\_api\_session\_manager](#module\_external\_api\_session\_manager) | github.com/pagopa/terraform-azurerm-v3//api_management_api | v8.27.0 |
| <a name="module_fims_api_session_manager"></a> [fims\_api\_session\_manager](#module\_fims\_api\_session\_manager) | github.com/pagopa/terraform-azurerm-v3//api_management_api | v8.27.0 |
| <a name="module_pagopa_api_session_manager"></a> [pagopa\_api\_session\_manager](#module\_pagopa\_api\_session\_manager) | github.com/pagopa/terraform-azurerm-v3//api_management_api | v8.27.0 |
| <a name="module_zendesk_api_session_manager"></a> [zendesk\_api\_session\_manager](#module\_zendesk\_api\_session\_manager) | github.com/pagopa/terraform-azurerm-v3//api_management_api | v8.27.0 |

## Resources

| Name | Type |
|------|------|
| [azurerm_api_management_api_tag.bpd_api_tag](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_tag) | resource |
| [azurerm_api_management_api_tag.external_api_tag](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_tag) | resource |
| [azurerm_api_management_api_tag.fims_api_tag](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_tag) | resource |
| [azurerm_api_management_api_tag.pagopa_api_tag](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_tag) | resource |
| [azurerm_api_management_api_tag.zendesk_api_tag](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_tag) | resource |
| [azurerm_api_management_api_version_set.auth_v1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_version_set) | resource |
| [azurerm_api_management_api_version_set.bpd_v1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_version_set) | resource |
| [azurerm_api_management_api_version_set.fims_v1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_version_set) | resource |
| [azurerm_api_management_api_version_set.pagopa_v1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_version_set) | resource |
| [azurerm_api_management_api_version_set.zendesk_v1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_api_version_set) | resource |
| [azurerm_api_management_backend.session_manager](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_backend) | resource |
| [azurerm_api_management_tag.session_manager_tag](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/api_management_tag) | resource |
| [azurerm_api_management_product.apim_platform_domain_product](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/api_management_product) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_bpd_api_base_path"></a> [bpd\_api\_base\_path](#input\_bpd\_api\_base\_path) | Base path for API | `string` | n/a | yes |
| <a name="input_external_api_base_path"></a> [external\_api\_base\_path](#input\_external\_api\_base\_path) | Base path for API | `string` | n/a | yes |
| <a name="input_fims_api_base_path"></a> [fims\_api\_base\_path](#input\_fims\_api\_base\_path) | Base path for API | `string` | n/a | yes |
| <a name="input_pagopa_api_base_path"></a> [pagopa\_api\_base\_path](#input\_pagopa\_api\_base\_path) | Base path for API | `string` | n/a | yes |
| <a name="input_platform_apim_id"></a> [platform\_apim\_id](#input\_platform\_apim\_id) | APIM Resource ID | `string` | n/a | yes |
| <a name="input_platform_apim_name"></a> [platform\_apim\_name](#input\_platform\_apim\_name) | APIM Resource name | `string` | n/a | yes |
| <a name="input_platform_apim_resource_group_name"></a> [platform\_apim\_resource\_group\_name](#input\_platform\_apim\_resource\_group\_name) | APIM Resource group name | `string` | n/a | yes |
| <a name="input_session_manager_url"></a> [session\_manager\_url](#input\_session\_manager\_url) | URL of session manager app service where to redirect requests | `string` | n/a | yes |
| <a name="input_zendesk_api_base_path"></a> [zendesk\_api\_base\_path](#input\_zendesk\_api\_base\_path) | Base path for API | `string` | n/a | yes |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
