variable "project" {
  description = "Project name; used for tagging and naming"
  type        = string
  default     = "ff"
}

variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for this workspace"
  type        = string
  default     = "eu-west-2"
}
