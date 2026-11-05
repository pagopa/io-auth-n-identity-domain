locals {
  app_name      = "ioweb-auth"
  auth_ca_image = "ghcr.io/pagopa/io-web-auth-service"

  listen_port = 8080

  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    },
    # The Fastify app reads HOST and PORT directly from env
    {
      name  = "HOST"
      value = "0.0.0.0"
    },
    {
      name  = "PORT"
      value = tostring(local.listen_port)
    },
    # Values aligned with the WEU session-manager configuration.
    {
      name  = "FETCH_KEEPALIVE_ENABLED"
      value = "true"
    },
    {
      name  = "FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL"
      value = "110000"
    },
    {
      name  = "FETCH_KEEPALIVE_MAX_SOCKETS"
      value = "128"
    },
    {
      name  = "FETCH_KEEPALIVE_MAX_FREE_SOCKETS"
      value = "10"
    },
    {
      name  = "FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT"
      value = "30000"
    },
    {
      name  = "FETCH_KEEPALIVE_TIMEOUT"
      value = "60000"
    },
  ]
}
