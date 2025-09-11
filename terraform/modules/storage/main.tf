# Storage module - DynamoDB and S3
# HIPAA-compliant storage with encryption

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

variable "enable_point_in_time_recovery" {
  description = "Enable PITR for DynamoDB"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}

# DynamoDB Tables
resource "aws_dynamodb_table" "sessions" {
  name           = "${var.name_prefix}-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_id = var.kms_key_id
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  deletion_protection_enabled = var.enable_deletion_protection

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-sessions"
    PHI  = "true"
  })
}

resource "aws_dynamodb_table" "audit_logs" {
  name           = "${var.name_prefix}-audit-logs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "log_id"
  range_key      = "timestamp"

  attribute {
    name = "log_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_id = var.kms_key_id
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  deletion_protection_enabled = var.enable_deletion_protection

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-audit-logs"
    HIPAA = "compliant"
  })
}

# S3 Bucket for Web Assets
resource "aws_s3_bucket" "web_assets" {
  bucket = "${var.name_prefix}-web-assets-${random_id.bucket_suffix.hex}"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-web-assets"
  })
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_encryption" "web_assets" {
  bucket = aws_s3_bucket.web_assets.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = var.kms_key_id
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "web_assets" {
  bucket = aws_s3_bucket.web_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SNS Topic for PHI violations
resource "aws_sns_topic" "phi_violations" {
  name = "${var.name_prefix}-phi-violations"

  kms_master_key_id = var.kms_key_id

  tags = var.tags
}

# Outputs
output "table_names" {
  value = {
    sessions    = aws_dynamodb_table.sessions.name
    audit_logs  = aws_dynamodb_table.audit_logs.name
  }
}

output "table_arns" {
  value = {
    sessions    = aws_dynamodb_table.sessions.arn
    audit_logs  = aws_dynamodb_table.audit_logs.arn
  }
}

output "web_assets_bucket_name" {
  value = aws_s3_bucket.web_assets.bucket
}

output "web_assets_bucket_domain" {
  value = aws_s3_bucket.web_assets.bucket_domain_name
}

output "phi_violation_topic_arn" {
  value = aws_sns_topic.phi_violations.arn
}