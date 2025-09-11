# Serenity AWS - Pilot Infrastructure (Terraform)
# HIPAA-compliant mental health platform infrastructure

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  
  # backend "s3" {
  #   # Configure after initial setup
  #   bucket = "serenity-terraform-state-${account_id}"
  #   key    = "pilot/terraform.tfstate" 
  #   region = "us-east-1"
  # }
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

# Minimal Infrastructure Modules for Pilot Validation
module "vpc" {
  source = "./modules/vpc"
  
  name_prefix    = local.name_prefix
  vpc_cidr       = var.vpc_cidr
  azs            = local.azs
  environment    = var.environment
  
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

# Output key values for pilot validation
output "infrastructure_outputs" {
  description = "Key infrastructure outputs for pilot deployment"
  value = {
    # Networking
    vpc_id             = module.vpc.vpc_id
    
    # Security
    kms_key_id         = module.kms.key_id
    
    # Environment
    environment        = var.environment
    region            = var.aws_region
  }
  sensitive = false
}