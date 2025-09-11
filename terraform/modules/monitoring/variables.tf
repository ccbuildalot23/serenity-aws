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