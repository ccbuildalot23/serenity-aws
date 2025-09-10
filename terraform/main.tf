# Serenity AWS - Pilot Infrastructure (Terraform)
# HIPAA-compliant mental health platform infrastructure

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    # Configure after initial setup
    # bucket = "serenity-terraform-state-${account_id}"
    # key    = "pilot/terraform.tfstate" 
    # region = "us-east-1"
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment   = var.environment
      Project       = "Serenity-AWS"
      Owner         = "DevOps"
      HIPAA         = "true"
      Compliance    = "required"
      ManagedBy     = "Terraform"
      PHI           = "protected"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  
  # HIPAA-compliant naming convention
  name_prefix = "${var.project_name}-${var.environment}"
  
  # AZ selection (3 AZs for high availability)
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
  
  # Common tags for all resources
  common_tags = {
    Environment   = var.environment
    Project       = var.project_name
    HIPAA         = "compliant"
    PHI           = "protected"
    BackupPolicy  = "required"
    Monitoring    = "enabled"
  }
}

# Core Infrastructure Modules
module "vpc" {
  source = "./modules/vpc"
  
  name_prefix    = local.name_prefix
  vpc_cidr       = var.vpc_cidr
  azs            = local.azs
  environment    = var.environment
  
  # HIPAA networking requirements
  enable_dns_hostnames = true
  enable_dns_support   = true
  enable_flow_logs     = true
  
  tags = local.common_tags
}

module "security" {
  source = "./modules/security"
  
  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  environment = var.environment
  
  # Security groups for different tiers
  alb_ingress_cidrs    = var.alb_allowed_cidrs
  api_port             = var.api_port
  enable_waf           = true
  
  tags = local.common_tags
}

module "kms" {
  source = "./modules/kms"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # HIPAA encryption requirements
  key_rotation_enabled = true
  deletion_window_days = 30
  
  tags = local.common_tags
}

module "secrets" {
  source = "./modules/secrets"
  
  name_prefix = local.name_prefix
  environment = var.environment
  kms_key_id  = module.kms.key_id
  
  tags = local.common_tags
}

module "cognito" {
  source = "./modules/cognito"
  
  name_prefix  = local.name_prefix
  environment  = var.environment
  domain_name  = var.domain_name
  kms_key_id   = module.kms.key_id
  
  # HIPAA-compliant user pool settings
  phi_session_timeout_minutes = var.phi_session_timeout_minutes
  mfa_required                = true
  advanced_security_mode      = "ENFORCED"
  
  tags = local.common_tags
}

module "storage" {
  source = "./modules/storage"
  
  name_prefix = local.name_prefix
  environment = var.environment
  kms_key_id  = module.kms.key_id
  
  # DynamoDB tables for PHI and audit data
  enable_point_in_time_recovery = true
  enable_deletion_protection     = var.environment == "prod"
  
  tags = local.common_tags
}

module "compute" {
  source = "./modules/compute"
  
  name_prefix      = local.name_prefix
  environment      = var.environment
  vpc_id           = module.vpc.vpc_id
  private_subnets  = module.vpc.private_subnets
  public_subnets   = module.vpc.public_subnets
  
  # ECS Fargate configuration
  api_cpu                = var.api_cpu
  api_memory             = var.api_memory
  api_desired_count      = var.api_desired_count
  api_max_capacity       = var.api_max_capacity
  
  # Security
  security_groups = {
    alb = module.security.alb_security_group_id
    ecs = module.security.ecs_security_group_id
  }
  
  # Dependencies
  kms_key_id                 = module.kms.key_id
  secrets_manager_arns       = module.secrets.secret_arns
  dynamodb_table_arns        = module.storage.table_arns
  cognito_user_pool_arn      = module.cognito.user_pool_arn
  
  tags = local.common_tags
}

module "cdn" {
  source = "./modules/cdn"
  
  name_prefix = local.name_prefix
  environment = var.environment
  domain_name = var.domain_name
  
  # Origins
  alb_dns_name = module.compute.alb_dns_name
  s3_bucket_domain = module.storage.web_assets_bucket_domain
  
  # Security
  waf_web_acl_id = module.security.waf_web_acl_id
  ssl_certificate_arn = var.ssl_certificate_arn
  
  tags = local.common_tags
}

module "monitoring" {
  source = "./modules/monitoring"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # Resources to monitor
  ecs_cluster_name  = module.compute.ecs_cluster_name
  ecs_service_name  = module.compute.ecs_service_name
  alb_arn_suffix    = module.compute.alb_arn_suffix
  dynamodb_tables   = module.storage.table_names
  
  # Alerting
  alert_email          = var.alert_email
  phi_violation_topic  = module.storage.phi_violation_topic_arn
  
  tags = local.common_tags
}

# Output key values for application configuration
output "infrastructure_outputs" {
  description = "Key infrastructure outputs for application deployment"
  value = {
    # Networking
    vpc_id             = module.vpc.vpc_id
    private_subnets    = module.vpc.private_subnets
    public_subnets     = module.vpc.public_subnets
    
    # Compute
    ecs_cluster_name   = module.compute.ecs_cluster_name
    alb_dns_name       = module.compute.alb_dns_name
    api_service_name   = module.compute.ecs_service_name
    
    # Storage
    dynamodb_tables    = module.storage.table_names
    s3_web_bucket      = module.storage.web_assets_bucket_name
    
    # Security
    kms_key_id         = module.kms.key_id
    
    # Identity
    cognito_user_pool_id     = module.cognito.user_pool_id
    cognito_user_pool_arn    = module.cognito.user_pool_arn
    cognito_client_id        = module.cognito.app_client_id
    cognito_domain           = module.cognito.domain
    
    # CDN
    cloudfront_distribution_id  = module.cdn.distribution_id
    cloudfront_domain_name      = module.cdn.domain_name
    
    # Monitoring
    log_group_names            = module.monitoring.log_group_names
    cloudwatch_dashboard_url   = module.monitoring.dashboard_url
  }
  sensitive = false
}

# Security outputs (marked sensitive)
output "sensitive_outputs" {
  description = "Sensitive outputs that should be stored securely"
  value = {
    cognito_client_secret    = module.cognito.app_client_secret
    database_passwords       = module.secrets.database_passwords
    api_secrets              = module.secrets.api_secrets
  }
  sensitive = true
}