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

variable "solana_register_program_id" {
  description = <<-EOT
    Address of the dev register instance on devnet - the `#[cfg(not(feature = "prod"))]` `declare_id!` in
    `fragments/blockchain/solana/programs/register/src/lib.rs`. The two instances share an authority but
    keep separate registries, so this is what isolates the dev pipeline.
  EOT
  type        = string
  default     = "DPEfE7E9LExX61taVQRQHpxZGkFEKLzRqwfCDMtzFg2K"
}

variable "solana_register_poller_schedule_expression" {
  description = "EventBridge Scheduler cron for the poller"
  type        = string
  default     = "cron(0 8-16 ? * MON-FRI *)"
}
