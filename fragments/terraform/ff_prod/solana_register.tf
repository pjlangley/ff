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

# --- secrets
#
# Terraform manages the secret *container* only - there is deliberately no `aws_secretsmanager_secret_version`,
# because that resource stores the plaintext in Terraform state (and `ff_prod` runs remotely, so the plaintext
# would also pass through an HCP runner).
#
# The values are set once, by hand, as the root user in the Secrets Manager console, exactly as in `ff_dev` -
# which is the only way to reach `ff_prod` at all, since it is otherwise addressable only by the HCP runner's
# OIDC roles. 
#
# The deployer keypair is the same key as `ff_dev`'s - it is the shared upgrade authority for both on-chain
# instances - but it is stored per environment so the consumer policy stays scoped to `ff_prod_*`.
#
# `recovery_window_in_days` is left at the 30-day default here.

resource "aws_secretsmanager_secret" "solana_register_deployer_keypair" {
  name        = "${local.name_prefix}_solana_register_deployer_keypair"
  description = "Devnet deployer keypair; the register program's upgrade and registry authority"
}

# The URL embeds the Helius API key, so it is a secret rather than a plaintext Lambda env var.
resource "aws_secretsmanager_secret" "solana_register_rpc_url" {
  name        = "${local.name_prefix}_solana_register_helius_rpc_url"
  description = "Helius devnet RPC URL, API key included"
}

# --- poller
#
# The bundle path is relative to the root module so both workspaces read the one artifact that
# `node --run solana_register_sync:build` writes. It sits under `fragments/terraform/` deliberately:
# `ff_prod` plans remotely on HCP, which uploads this directory (see `terraform_deploy.yml`), and the
# runner has no Node.js toolchain to build with. The file is gitignored, so a `plan` needs the build
# run first.

module "solana_register_poller" {
  source = "../modules/solana_register_poller"

  name        = "solana_register_poller"
  name_prefix = local.name_prefix

  bundle_path = "${path.root}/../lambda_dist/solana_register_poller/index.js"

  program_id         = var.solana_register_program_id
  table_name         = module.solana_register_registrations_table.table_name
  table_arn          = module.solana_register_registrations_table.table_arn
  event_bus_name     = aws_cloudwatch_event_bus.solana_register.name
  event_bus_arn      = aws_cloudwatch_event_bus.solana_register.arn
  event_source       = local.solana_register_event_source
  rpc_url_secret_arn = aws_secretsmanager_secret.solana_register_rpc_url.arn

  schedule_expression = var.solana_register_poller_schedule_expression
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

output "solana_register_deployer_keypair_secret_name" {
  description = "Name of the deployer keypair secret; the value is populated out of band"
  value       = aws_secretsmanager_secret.solana_register_deployer_keypair.name
}

output "solana_register_deployer_keypair_secret_arn" {
  description = "ARN of the deployer keypair secret"
  value       = aws_secretsmanager_secret.solana_register_deployer_keypair.arn
}

output "solana_register_rpc_url_secret_name" {
  description = "Name of the Helius RPC URL secret; the value is populated out of band"
  value       = aws_secretsmanager_secret.solana_register_rpc_url.name
}

output "solana_register_rpc_url_secret_arn" {
  description = "ARN of the Helius RPC URL secret"
  value       = aws_secretsmanager_secret.solana_register_rpc_url.arn
}

output "solana_register_poller_function_name" {
  description = "Name of the poller Lambda"
  value       = module.solana_register_poller.function_name
}

output "solana_register_poller_function_arn" {
  description = "ARN of the poller Lambda"
  value       = module.solana_register_poller.function_arn
}

output "solana_register_poller_log_group_name" {
  description = "CloudWatch log group the poller writes its per-invocation summary to"
  value       = module.solana_register_poller.log_group_name
}

output "solana_register_poller_schedule_name" {
  description = "Name of the EventBridge Scheduler schedule that invokes the poller"
  value       = module.solana_register_poller.schedule_name
}
