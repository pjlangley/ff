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
