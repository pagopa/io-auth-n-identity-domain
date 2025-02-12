module "io_public_apim_api_weu" {
  source = "../../modules/io_public_api"

  apim_name                = local.apim_v2_name
  apim_resource_group_name = local.apim_resource_group_name

  key_vault_common_id = data.azurerm_key_vault.common_kv.id

  api_host_name       = "api.io.pagopa.it"
  function_public_url = "https://${module.function_public.function_app.function_app.default_hostname}"
}

module "io_public_apim_api_itn" {
  source = "../../modules/io_public_api"

  apim_name                = local.apim_itn_name
  apim_resource_group_name = local.apim_itn_resource_group_name

  key_vault_common_id = data.azurerm_key_vault.common_kv.id

  api_host_name       = "api.io.pagopa.it"
  function_public_url = "https://${module.function_public.function_app.function_app.default_hostname}"
}

# IMPORTS - TODO: remove the following lines after changes have been applied
import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/namedValues/io-fn3-public-key"
  to = module.io_public_apim_api_itn.azurerm_api_management_named_value.io_fn3_public_key_v2
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/namedValues/io-fn3-public-url"
  to = module.io_public_apim_api_itn.azurerm_api_management_named_value.io_fn3_public_url_v2
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/apis/io-public-api;rev=1"
  to = module.io_public_apim_api_itn.module.api_v2_public.azurerm_api_management_api.this
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/apis/io-public-api"
  to = module.io_public_apim_api_itn.module.api_v2_public.azurerm_api_management_api_policy.this[0]
}


import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/products/io-public-api/apis/io-public-api"
  to = module.io_public_apim_api_itn.module.api_v2_public.azurerm_api_management_product_api.this["io-public-api"]
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/products/io-public-api"
  to = module.io_public_apim_api_itn.module.apim_v2_product_public.azurerm_api_management_product.this
}

import {
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/products/io-public-api"
  to = module.io_public_apim_api_itn.module.apim_v2_product_public.azurerm_api_management_product_policy.this[0]
}
