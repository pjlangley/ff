variable "name" {
  description = "Base name of the poller; composed with name_prefix to form the function, schedule and role names"
  type        = string
}

variable "name_prefix" {
  description = "Prefix applied to every name this module creates (e.g. \"ff_dev\")"
  type        = string
}

variable "bundle_path" {
  description = <<-EOT
    Path to the esbuild bundle of `fragments/solana_register_sync/poller.ts`, produced by
    `node --run solana_register_sync:build`. Zipped by this module; the file must exist before `plan`.
  EOT
  type        = string
}

variable "program_id" {
  description = "Address of the on-chain register instance this environment polls"
  type        = string
}

variable "table_name" {
  description = "Name of the registrations table the poller reads the watermark from and writes records to"
  type        = string
}

variable "table_arn" {
  description = "ARN of the registrations table; scopes the function's DynamoDB grant"
  type        = string
}

variable "event_bus_name" {
  description = "Name of the custom bus the poller publishes RegistrationDetected to"
  type        = string
}

variable "event_bus_arn" {
  description = "ARN of the custom bus; scopes the function's events:PutEvents grant"
  type        = string
}

variable "event_source" {
  description = "Value of the event envelope's `source` field; must match what the bus rules select on"
  type        = string
}

variable "rpc_url_secret_arn" {
  description = <<-EOT
    ARN of the Secrets Manager secret holding the Helius RPC URL. Travels to the function as a plaintext
    env var because the identifier is not itself sensitive - the URL it points at is.
  EOT
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge Scheduler cron expression, evaluated in schedule_timezone"
  type        = string
}

variable "schedule_timezone" {
  description = "IANA timezone the cron expression is evaluated in; a named zone keeps the window DST-safe"
  type        = string
  default     = "Europe/London"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the function's log group"
  type        = number
  default     = 7
}

variable "timeout" {
  description = "Function timeout in seconds; one invocation makes two RPC round trips to Helius"
  type        = number
  default     = 60
}

variable "memory_size" {
  description = "Function memory in MB"
  type        = number
  default     = 512
}
