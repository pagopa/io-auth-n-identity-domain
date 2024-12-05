import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-internal/providers/Microsoft.ApiManagement/service/io-p-apim-v2-api/apis/io-p-ioweb-bff/operations/unlockUserSession"
    to = module.webprofile_apim_api_weu.azurerm_api_management_api_operation_policy.unlock_user_session_policy_itn
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-internal/providers/Microsoft.ApiManagement/service/io-p-apim-v2-api/namedValues/ioweb-profile-api-key"
    to = module.webprofile_apim_api_weu.azurerm_api_management_named_value.io_fn3_services_key_itn
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/apis/io-p-ioweb-bff"
    to = module.webprofile_apim_api_itn.module.apim_itn_bff_api.azurerm_api_management_api.this
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/apis/io-p-ioweb-bff"
    to = module.webprofile_apim_api_itn.module.apim_itn_bff_api.azurerm_api_management_api_policy.this[0]
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/products/io-web-api/apis/io-p-ioweb-bff"
    to = module.webprofile_apim_api_itn.module.apim_itn_bff_api.azurerm_api_management_product_api.this["io-web-api"]
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-internal/providers/Microsoft.ApiManagement/service/io-p-apim-v2-api/apis/io-p-ioweb-bff"
    to = module.webprofile_apim_api_weu.module.apim_itn_bff_api.azurerm_api_management_api.this
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-internal/providers/Microsoft.ApiManagement/service/io-p-apim-v2-api/apis/io-p-ioweb-bff"
    to = module.webprofile_apim_api_weu.module.apim_itn_bff_api.azurerm_api_management_api_policy.this[0]
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-internal/providers/Microsoft.ApiManagement/service/io-p-apim-v2-api/products/io-web-api/apis/io-p-ioweb-bff"
    to = module.webprofile_apim_api_weu.module.apim_itn_bff_api.azurerm_api_management_product_api.this["io-web-api"]
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/apis/io-p-ioweb-bff/operations/unlockUserSession"
    to = module.webprofile_apim_api_itn.azurerm_api_management_api_operation_policy.unlock_user_session_policy_itn
}

import {
    id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.ApiManagement/service/io-p-itn-apim-01/namedValues/ioweb-profile-api-key"
    to = module.webprofile_apim_api_itn.azurerm_api_management_named_value.io_fn3_services_key_itn
}