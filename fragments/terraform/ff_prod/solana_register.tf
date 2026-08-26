module "solana_register_registrants_queue" {
  source = "../modules/sqs_queue_with_dlq"

  name        = "solana_register_registrants"
  name_prefix = local.name_prefix
}

module "solana_register_registrants_confirmed_queue" {
  source = "../modules/sqs_queue_with_dlq"

  name        = "solana_register_registrants_confirmed"
  name_prefix = local.name_prefix
}

module "solana_register_registrations_table" {
  source = "../modules/solana_registrations_table"

  name        = "solana_register_registrations"
  name_prefix = local.name_prefix
}

# --- events
#
# Producers publish to this bus and never address a queue directly; the rules below deliver to the queues,
# so a future subscriber attaches as its own rule + queue (fan-out) instead of competing on an existing one.
#
# Event envelope, settled here because the poller and both consumers encode against it:
#   source       local.solana_register_event_source
#   detail-type  "RegistrationDetected" | "RegistrationConfirmed"
#   detail       RegistrationDetected  - { program_id, registrant, registration_index, registered_at }
#                RegistrationConfirmed - { program_id, registrant, registration_index, confirmed_at, signature }
# `registered_at` / `confirmed_at` are on-chain slots; `signature` is the confirming transaction.

resource "aws_cloudwatch_event_bus" "solana_register" {
  name        = "${local.name_prefix}_solana_register"
  description = "Register pipeline events; rules fan out to one SQS queue per subscriber"
}

module "solana_register_registration_detected_rule" {
  source = "../modules/eventbridge_rule_to_sqs"

  name           = "registration_detected"
  description    = "Deliver newly detected registrations to the registrants queue"
  event_bus_name = aws_cloudwatch_event_bus.solana_register.name
  event_source   = local.solana_register_event_source
  detail_type    = "RegistrationDetected"
  queue_arn      = module.solana_register_registrants_queue.queue_arn
  queue_url      = module.solana_register_registrants_queue.queue_url
}

module "solana_register_registration_confirmed_rule" {
  source = "../modules/eventbridge_rule_to_sqs"

  name           = "registration_confirmed"
  description    = "Deliver on-chain confirmations to the confirmed queue for auditing"
  event_bus_name = aws_cloudwatch_event_bus.solana_register.name
  event_source   = local.solana_register_event_source
  detail_type    = "RegistrationConfirmed"
  queue_arn      = module.solana_register_registrants_confirmed_queue.queue_arn
  queue_url      = module.solana_register_registrants_confirmed_queue.queue_url
}

# --- outputs

output "solana_register_registrants_queue_arn" {
  description = "ARN of the solana_register_registrants source queue"
  value       = module.solana_register_registrants_queue.queue_arn
}

output "solana_register_registrants_queue_url" {
  description = "URL of the solana_register_registrants source queue"
  value       = module.solana_register_registrants_queue.queue_url
}

output "solana_register_registrants_dlq_arn" {
  description = "ARN of the solana_register_registrants dead-letter queue"
  value       = module.solana_register_registrants_queue.dlq_arn
}

output "solana_register_registrants_dlq_url" {
  description = "URL of the solana_register_registrants dead-letter queue"
  value       = module.solana_register_registrants_queue.dlq_url
}

output "solana_register_registrants_confirmed_queue_arn" {
  description = "ARN of the solana_register_registrants_confirmed source queue"
  value       = module.solana_register_registrants_confirmed_queue.queue_arn
}

output "solana_register_registrants_confirmed_queue_url" {
  description = "URL of the solana_register_registrants_confirmed source queue"
  value       = module.solana_register_registrants_confirmed_queue.queue_url
}

output "solana_register_registrants_confirmed_dlq_arn" {
  description = "ARN of the solana_register_registrants_confirmed dead-letter queue"
  value       = module.solana_register_registrants_confirmed_queue.dlq_arn
}

output "solana_register_registrants_confirmed_dlq_url" {
  description = "URL of the solana_register_registrants_confirmed dead-letter queue"
  value       = module.solana_register_registrants_confirmed_queue.dlq_url
}

output "solana_register_registrations_table_name" {
  description = "Name of the solana_register_registrations DynamoDB table"
  value       = module.solana_register_registrations_table.table_name
}

output "solana_register_registrations_table_arn" {
  description = "ARN of the solana_register_registrations DynamoDB table"
  value       = module.solana_register_registrations_table.table_arn
}

output "solana_register_event_bus_name" {
  description = "Name of the solana_register custom EventBridge bus"
  value       = aws_cloudwatch_event_bus.solana_register.name
}

output "solana_register_event_bus_arn" {
  description = "ARN of the solana_register custom EventBridge bus"
  value       = aws_cloudwatch_event_bus.solana_register.arn
}

output "solana_register_event_source" {
  description = "`source` field producers must set on every event published to the solana_register bus"
  value       = local.solana_register_event_source
}
