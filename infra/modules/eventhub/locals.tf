locals {

  function_name = "io-fn-elt"

  evhns = {
    tier = "m"

    eventhubs = [{
      name                   = "service-preferences"
      partitions             = 30
      message_retention_days = 7
      consumers              = []
      keys = [
        {
          name   = local.function_name
          listen = false
          send   = true
          manage = false
        },
        {
          name   = "pdnd"
          listen = true
          send   = false
          manage = false
        }
      ]
      },
      {
        name                   = "profiles"
        partitions             = 30
        message_retention_days = 7
        consumers              = []
        keys = [
          {
            name   = local.function_name
            listen = false
            send   = true
            manage = false
          },
          {
            name   = "pdnd"
            listen = true
            send   = false
            manage = false
          }
        ]
      },
      {
        name                   = "profile-deletion"
        partitions             = 30
        message_retention_days = 7
        consumers              = []
        keys = [
          {
            name   = local.function_name
            listen = false
            send   = true
            manage = false
          },
          {
            name   = "pdnd"
            listen = true
            send   = false
            manage = false
          }
        ]
      }
    ]

    metric_alerts = {
      throttled_requests = {
        aggregation = "Count"
        metric_name = "ThrottledRequests"
        description = "Too Many Throttled Requests"
        operator    = "GreaterThan"
        threshold   = 20 #TODO: FINE TUNING NEEDED
        frequency   = "PT5M"
        window_size = "PT15M"
      },
      user_errors = {
        aggregation = "Count"
        metric_name = "UserErrors"
        description = "Too Many User Errors"
        operator    = "GreaterThan"
        threshold   = 0 #TODO: FINE TUNING NEEDED
        frequency   = "PT5M"
        window_size = "PT15M"
      },
      # active_connections = {
      #   aggregation = "Average"
      #   metric_name = "ActiveConnections"
      #   description = null
      #   operator    = "LessThanOrEqual"
      #   threshold   = 0
      #   frequency   = "PT5M"
      #   window_size = "PT15M"
      #   dimension   = [],
      # }, TODO: Enable when production ready
    }

    allowed_sources = {
      subnet_ids = []
      ips = [
        "18.192.147.151", # PDND
        "18.159.227.69",  # PDND
        "3.126.198.129"   # PDND
      ]
    }
  }
}