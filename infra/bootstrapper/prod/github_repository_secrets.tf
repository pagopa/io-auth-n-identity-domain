resource "github_actions_secret" "repo_secrets" {
  for_each = toset(local.repo_secrets)

  repository  = module.repo.repository.name
  secret_name = each.key
  value       = "placeholder"

  lifecycle {
    ignore_changes = [remote_updated_at]
  }
}
