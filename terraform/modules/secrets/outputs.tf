output "cognito_secret_arn" {
  description = "ARN of Cognito client secret"
  value       = aws_secretsmanager_secret.cognito_client_secret.arn
}

output "database_secret_arn" {
  description = "ARN of database credentials secret"
  value       = aws_secretsmanager_secret.database_credentials.arn
}