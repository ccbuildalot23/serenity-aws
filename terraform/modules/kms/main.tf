# KMS module - Customer-managed encryption keys
# HIPAA-compliant encryption for all PHI data

# KMS Key for PHI encryption
resource "aws_kms_key" "main" {
  description             = "${var.name_prefix} PHI encryption key"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = var.key_rotation_enabled

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ECS/Lambda access"
        Effect = "Allow"
        Principal = {
          Service = [
            "ecs-tasks.amazonaws.com",
            "lambda.amazonaws.com",
            "dynamodb.amazonaws.com",
            "s3.amazonaws.com",
            "secretsmanager.amazonaws.com"
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-kms-key"
    Type = "PHI-encryption"
  })
}

data "aws_caller_identity" "current" {}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.name_prefix}-phi-key"
  target_key_id = aws_kms_key.main.key_id
}

# Outputs
output "key_id" {
  value = aws_kms_key.main.key_id
}

output "key_arn" {
  value = aws_kms_key.main.arn
}

output "alias_name" {
  value = aws_kms_alias.main.name
}