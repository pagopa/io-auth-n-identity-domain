data "azurerm_resource_group" "core_domain_data_rg" {
  name = "${local.common_project}-citizen-auth-data-rg"
}

data "azurerm_cosmosdb_account" "cosmos_citizen_auth" {
  name                = "${local.common_project}-citizen-auth-account"
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
}

data "azurerm_cosmosdb_account" "cosmos_api" {
  name                = format("%s-cosmos-api", local.common_project)
  resource_group_name = format("%s-rg-internal", local.common_project)
}

#
# Session Manager database
#
resource "azurerm_cosmosdb_sql_database" "session_manager" {
  name                = "io-auth-SM"
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
  account_name        = data.azurerm_cosmosdb_account.cosmos_citizen_auth.name
}

resource "azurerm_cosmosdb_sql_container" "session_tokens" {
  name                = "session-tokens"
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
  account_name        = data.azurerm_cosmosdb_account.cosmos_citizen_auth.name
  database_name       = azurerm_cosmosdb_sql_database.session_manager.name

  partition_key_paths   = ["/sessionId"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/id/?"
    }

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
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
  account_name        = data.azurerm_cosmosdb_account.cosmos_citizen_auth.name
  database_name       = azurerm_cosmosdb_sql_database.session_manager.name

  partition_key_paths   = ["/fiscalCode"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/id/?"
    }

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
  resource_group_name = data.azurerm_resource_group.core_domain_data_rg.name
  account_name        = data.azurerm_cosmosdb_account.cosmos_citizen_auth.name
  database_name       = azurerm_cosmosdb_sql_database.session_manager.name

  partition_key_paths   = ["/fiscalCode"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/id/?"
    }

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
