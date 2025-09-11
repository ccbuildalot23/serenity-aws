output "web_assets_bucket_id" {
  description = "S3 bucket ID for web assets"
  value       = aws_s3_bucket.web_assets.id
}

output "web_assets_bucket_regional_domain_name" {
  description = "S3 bucket regional domain name for web assets"
  value       = aws_s3_bucket.web_assets.bucket_regional_domain_name
}

output "audit_logs_bucket_id" {
  description = "S3 bucket ID for audit logs"
  value       = aws_s3_bucket.audit_logs.id
}

output "session_table_name" {
  description = "DynamoDB table name for sessions"
  value       = aws_dynamodb_table.sessions.name
}

output "audit_table_name" {
  description = "DynamoDB table name for audit logs"
  value       = aws_dynamodb_table.audit.name
}