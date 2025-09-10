# Cognito Module Outputs

output "user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Endpoint of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.endpoint
}

output "app_client_id" {
  description = "ID of the SPA app client"
  value       = aws_cognito_user_pool_client.spa.id
}

output "app_client_secret" {
  description = "Secret of the server app client"
  value       = aws_cognito_user_pool_client.server.client_secret
  sensitive   = true
}

output "server_client_id" {
  description = "ID of the server app client"
  value       = aws_cognito_user_pool_client.server.id
}

output "domain" {
  description = "Cognito domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "domain_aws_alias" {
  description = "AWS alias for Cognito domain"
  value       = aws_cognito_user_pool_domain.main.aws_account_id
}

output "identity_pool_id" {
  description = "ID of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.main.id
}

output "user_groups" {
  description = "Map of user group names to their details"
  value = {
    patients = {
      name = aws_cognito_user_group.patients.name
      role_arn = aws_cognito_user_group.patients.role_arn
    }
    providers = {
      name = aws_cognito_user_group.providers.name
      role_arn = aws_cognito_user_group.providers.role_arn
    }
    supporters = {
      name = aws_cognito_user_group.supporters.name
      role_arn = aws_cognito_user_group.supporters.role_arn
    }
    admins = {
      name = aws_cognito_user_group.admins.name
      role_arn = aws_cognito_user_group.admins.role_arn
    }
  }
}

# JWKS URL for token verification
output "jwks_uri" {
  description = "JWKS URI for token verification"
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}/.well-known/jwks.json"
}

# OAuth URLs
output "oauth_urls" {
  description = "OAuth URLs for the user pool"
  value = {
    authorize_url = "https://${aws_cognito_user_pool_domain.main.domain}/oauth2/authorize"
    token_url     = "https://${aws_cognito_user_pool_domain.main.domain}/oauth2/token"
    userinfo_url  = "https://${aws_cognito_user_pool_domain.main.domain}/oauth2/userInfo"
    logout_url    = "https://${aws_cognito_user_pool_domain.main.domain}/logout"
  }
}