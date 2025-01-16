locals {

  # You can retrieve the list of current defined subnets using the CLI command
  # az network vnet subnet list --subscription PROD-IO --vnet-name io-p-itn-common-vnet-01 --resource-group io-p-itn-common-rg-01 --output table
  # and thus define new CIDRs according to the unallocated address space
  cidr_subnet_fn_lv          = "10.20.20.0/26"
  cidr_subnet_fn_lollipop    = "10.20.20.64/26"
  cidr_subnet_fn_web_profile = "10.20.24.0/26"
  cidr_subnet_fn_public      = "10.20.24.64/26"
}
