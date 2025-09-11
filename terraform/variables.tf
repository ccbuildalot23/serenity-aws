# Serenity AWS - Terraform Variables
# Input variables for pilot infrastructure deployment

# Core Configuration
variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

variable "environment" {
  description = "Environment name (pilot, prod)"
  type        = string
  default     = "pilot"
  
  validation {
    condition     = contains(["pilot", "prod", "dev"], var.environment)
    error_message = "Environment must be pilot, prod, or dev."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "serenity"
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.project_name))
    error_message = "Project name must start with a letter and contain only lowercase letters, numbers, and hyphens."
  }
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid CIDR block."
  }
}

variable "alb_allowed_cidrs" {
  description = "CIDR blocks allowed to access ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Internet access - restrict in production
  
  validation {
    condition     = alltrue([for cidr in var.alb_allowed_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All CIDR blocks must be valid."
  }
}

# Application Configuration
variable "api_port" {
  description = "Port for API service"
  type        = number
  default     = 3001
  
  validation {
    condition     = var.api_port > 1024 && var.api_port < 65536
    error_message = "API port must be between 1024 and 65535."
  }
}

variable "phi_session_timeout_minutes" {
  description = "PHI session timeout in minutes (HIPAA requirement)"
  type        = number
  default     = 15
  
  validation {
    condition     = var.phi_session_timeout_minutes >= 1 && var.phi_session_timeout_minutes <= 60
    error_message = "PHI session timeout must be between 1 and 60 minutes."
  }
}

# ECS Fargate Configuration
variable "api_cpu" {
  description = "CPU units for API service (256, 512, 1024, etc.)"
  type        = number
  default     = 512
  
  validation {
    condition = contains([256, 512, 1024, 2048, 4096], var.api_cpu)
    error_message = "API CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "api_memory" {
  description = "Memory MB for API service"
  type        = number
  default     = 1024
  
  validation {
    condition = var.api_memory >= 512 && var.api_memory <= 30720
    error_message = "API memory must be between 512 MB and 30720 MB."
  }
}

variable "api_desired_count" {
  description = "Desired number of API service tasks"
  type        = number
  default     = 2
  
  validation {
    condition     = var.api_desired_count >= 1 && var.api_desired_count <= 100
    error_message = "API desired count must be between 1 and 100."
  }
}

variable "api_max_capacity" {
  description = "Maximum number of API service tasks for auto-scaling"
  type        = number
  default     = 10
  
  validation {
    condition     = var.api_max_capacity >= var.api_desired_count && var.api_max_capacity <= 100
    error_message = "API max capacity must be >= desired count and <= 100."
  }
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application (e.g., serenityhealth.com)"
  type        = string
  default     = ""
  
  validation {
    condition = var.domain_name == "" || can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain (e.g., example.com)."
  }
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS (leave empty to create self-signed for pilot)"
  type        = string
  default     = ""
}

# Monitoring & Alerting
variable "alert_email" {
  description = "Email address for infrastructure alerts"
  type        = string
  default     = "alerts@serenityhealth.io"
  
  validation {
    condition     = can(regex("^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Alert email must be a valid email address."
  }
}

# Feature Flags
variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable detailed monitoring"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

variable "enable_cloudtrail" {
  description = "Enable CloudTrail for audit logging"
  type        = bool
  default     = true
}

# HIPAA Compliance Settings
variable "require_mfa" {
  description = "Require MFA for Cognito users (HIPAA best practice)"
  type        = bool
  default     = true
}

variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for all storage services"
  type        = bool
  default     = true
}

variable "enable_encryption_in_transit" {
  description = "Enforce encryption in transit"
  type        = bool
  default     = true
}

variable "audit_log_retention_days" {
  description = "Audit log retention period in days (HIPAA: minimum 6 years = 2190 days)"
  type        = number
  default     = 2555  # ~7 years for safety margin
  
  validation {
    condition     = var.audit_log_retention_days >= 2190
    error_message = "Audit log retention must be at least 2190 days for HIPAA compliance."
  }
}

# Cost Control
variable "enable_cost_optimization" {
  description = "Enable cost optimization features"
  type        = bool
  default     = true
}

variable "reserved_capacity_percentage" {
  description = "Percentage of capacity to reserve for cost savings"
  type        = number
  default     = 50
  
  validation {
    condition     = var.reserved_capacity_percentage >= 0 && var.reserved_capacity_percentage <= 100
    error_message = "Reserved capacity percentage must be between 0 and 100."
  }
}