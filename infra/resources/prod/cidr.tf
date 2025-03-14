locals {

  # You can retrieve the list of current defined subnets using the CLI command
  # az network vnet subnet list --subscription PROD-IO --vnet-name io-p-itn-common-vnet-01 --resource-group io-p-itn-common-rg-01 --output table
  # and thus define new CIDRs according to the unallocated address space
  cidr_subnet_fn_lv            = "10.20.20.0/26"
  cidr_subnet_fn_lollipop      = "10.20.20.64/26"
  cidr_subnet_fn_web_profile   = "10.20.24.0/26"
  cidr_subnet_fn_profile_async = "10.20.29.0/26"
  cidr_subnet_fn_profile       = "10.20.29.64/26"
  # the shared subnet can hold several app_service_plans(64 IPs are available for it)
  # TODO: change fn_web_profile to use this instead of a dedicated subnet
  cidr_subnet_fn_shared = "10.20.18.64/26"
}
