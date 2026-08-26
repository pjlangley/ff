variable "name" {
  description = "Name of the rule; namespaced by the bus it sits on, so it carries no environment prefix"
  type        = string
}

variable "description" {
  description = "Description of the rule"
  type        = string
}

variable "event_bus_name" {
  description = "Name of the custom event bus the rule is created on"
  type        = string
}

variable "event_source" {
  description = "Value of the event envelope's `source` field the rule matches on (e.g. \"ff.solana.register\")"
  type        = string
}

variable "detail_type" {
  description = "Value of the event envelope's `detail-type` field the rule matches on (e.g. \"RegistrationDetected\")"
  type        = string
}

variable "queue_arn" {
  description = "ARN of the SQS queue the matched events are delivered to"
  type        = string
}

variable "queue_url" {
  description = "URL of the SQS queue the matched events are delivered to; the queue policy is attached to it"
  type        = string
}
