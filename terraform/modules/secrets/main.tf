# Secrets module - AWS Secrets Manager
# HIPAA-compliant secrets management

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}

# Database passwords
resource "aws_secretsmanager_secret" "database" {
  name                    = "${var.name_prefix}/database/credentials"
  description             = "Database credentials for ${var.environment}"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-database-secret"
    Type = "database"
  })
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = "serenity_admin"
    password = "CHANGE_ME_IN_PRODUCTION"
  })
}

# API secrets
resource "aws_secretsmanager_secret" "api" {
  name                    = "${var.name_prefix}/api/secrets"
  description             = "API secrets for ${var.environment}"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-secrets"
    Type = "api"
  })
}

resource "aws_secretsmanager_secret_version" "api" {
  secret_id = aws_secretsmanager_secret.api.id
  secret_string = jsonencode({
    jwt_secret     = "CHANGE_ME_IN_PRODUCTION"
    encryption_key = "CHANGE_ME_IN_PRODUCTION"
  })
}

# Outputs
output "secret_arns" {
  value = {
    database = aws_secretsmanager_secret.database.arn
    api      = aws_secretsmanager_secret.api.arn
  }
}

output "database_passwords" {
  value = {
    secret_name = aws_secretsmanager_secret.database.name
  }
  sensitive = true
}

output "api_secrets" {
  value = {
    secret_name = aws_secretsmanager_secret.api.name
  }
  sensitive = true
}