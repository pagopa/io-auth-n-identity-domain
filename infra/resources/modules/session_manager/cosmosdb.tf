resource "azurerm_cosmosdb_sql_database" "session_manager" {
  name                = "io-auth-SM"
  resource_group_name = var.session_cosmos.resource_group_name
  account_name        = var.session_cosmos.account_name
}

resource "azurerm_cosmosdb_sql_container" "session_tokens" {
  name                = "session-tokens"
  resource_group_name = var.session_cosmos.resource_group_name
  account_name        = var.session_cosmos.account_name
  database_name       = azurerm_cosmosdb_sql_database.session_manager.name

  partition_key_paths   = ["/sessionId"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/sessionId/?"
    }

    excluded_path {
      path = "/*"
    }
  }

  autoscale_settings {
    max_throughput = 9000
  }

  default_ttl = -1
}

resource "azurerm_cosmosdb_sql_container" "active_sessions" {
  name                = "active-sessions"
  resource_group_name = var.session_cosmos.resource_group_name
  account_name        = var.session_cosmos.account_name
  database_name       = azurerm_cosmosdb_sql_database.session_manager.name

  partition_key_paths   = ["/fiscalCode"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/fiscalCode/?"
    }

    excluded_path {
      path = "/*"
    }
  }

  autoscale_settings {
    max_throughput = 9000
  }

  default_ttl = -1
}

resource "azurerm_cosmosdb_sql_container" "lollipop_activations" {
  name                = "lollipop-activations"
  resource_group_name = var.session_cosmos.resource_group_name
  account_name        = var.session_cosmos.account_name
  database_name       = azurerm_cosmosdb_sql_database.session_manager.name

  partition_key_paths   = ["/fiscalCode"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/fiscalCode/?"
    }

    excluded_path {
      path = "/*"
    }
  }

  autoscale_settings {
    max_throughput = 9000
  }

  default_ttl = -1
}
