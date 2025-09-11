variable "vpc_id" {
  description = "VPC ID where security groups will be created"
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