variable "environment" {
  description = "Environment name"
  type        = string
  default     = "pilot"
}

variable "kms_key_id" {
  description = "KMS key ID for secret encryption"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}