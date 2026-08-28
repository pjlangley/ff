variable "queue_arns" {
  description = "ARNs of the SQS queues the consumers receive from (registrants and confirmed)"
  type        = list(string)
}

variable "table_arn" {
  description = "ARN of the registrations DynamoDB table the consumers read and write"
  type        = string
}

variable "secret_arns" {
  description = "ARNs of the Secrets Manager secrets the consumers read at startup (deployer keypair, RPC URL)"
  type        = list(string)
}

variable "event_bus_arn" {
  description = "ARN of the custom EventBridge bus the consumers publish confirmations to"
  type        = string
}
