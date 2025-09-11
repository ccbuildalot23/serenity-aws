variable "kms_key_id" {
  description = "KMS key ID for encryption"
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