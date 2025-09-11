variable "vpc_id" {
  description = "VPC ID where resources will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for ALB"
  type        = list(string)
}

variable "security_group_alb_id" {
  description = "Security group ID for ALB"
  type        = string
}

variable "security_group_ecs_id" {
  description = "Security group ID for ECS"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "pilot"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}