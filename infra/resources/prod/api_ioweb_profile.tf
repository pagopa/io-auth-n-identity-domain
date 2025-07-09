module "webprofile_apim_api_itn" {
  source                        = "../modules/ioweb_profile_api"
  prefix                        = local.prefix
  env_short                     = local.env_short
  apim_name                     = local.apim_itn_name
  apim_resource_group_name      = local.apim_itn_resource_group_name
  function_web_profile_basepath = local.io_web_profile_bff_basepath
  function_web_profile_hostname = module.function_web_profile.function_app.function_app.default_hostname
}
