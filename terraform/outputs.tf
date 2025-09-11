output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of public subnet IDs"  
  value       = module.vpc.public_subnets
}

output "database_subnets" {
  description = "List of database subnet IDs"
  value       = module.vpc.database_subnets
}

output "nat_gateway_ips" {
  description = "List of NAT gateway IPs"
  value       = module.vpc.nat_gateway_ips
}

output "kms_key_id" {
  description = "KMS key ID for encryption"
  value       = module.kms.key_id
  sensitive   = true
}

output "kms_key_arn" {
  description = "KMS key ARN"
  value       = module.kms.key_arn
}

# Secrets manager output removed - module not implemented yet
# output "secrets_manager_arn" {
#   description = "Secrets Manager ARN"
#   value       = module.secrets.secret_arn
#   sensitive   = true
# }