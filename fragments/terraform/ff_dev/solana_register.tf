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
# because that resource stores the plaintext in Terraform state.
#
# The values are set once, by hand, as the root user in the Secrets Manager console - the same posture already
# used for the IAM policies these workspaces depend on (see ADR 003). 
#
#   ff_dev_solana_register_deployer_keypair  <- contents of devnet_deployer.id.json
#   ff_dev_solana_register_helius_rpc_url    <- https://devnet.helius-rpc.com/?api-key=<YOUR_HELIUS_KEY>
#
# Because the console handles this, the local Terraform IAM user deliberately holds neither `PutSecretValue`
# nor `GetSecretValue` - it creates the containers and nothing more.
#
# `recovery_window_in_days = 0` deletes immediately instead of holding the name for 30 days - a held name
# blocks re-creating the same secret, which would stall the dev tear-down/stand-up loop. `ff_prod` keeps the
# 30-day default.

resource "aws_secretsmanager_secret" "solana_register_deployer_keypair" {
  name                    = "${local.name_prefix}_solana_register_deployer_keypair"
  description             = "Devnet deployer keypair; the register program's upgrade and registry authority"
  recovery_window_in_days = 0
}

# The URL embeds the Helius API key, so it is a secret rather than a plaintext Lambda env var.
resource "aws_secretsmanager_secret" "solana_register_rpc_url" {
  name                    = "${local.name_prefix}_solana_register_helius_rpc_url"
  description             = "Helius devnet RPC URL, API key included"
  recovery_window_in_days = 0
}

# --- local KIND runtime identity
#
# Only `ff_dev` has this user: local KIND runs the consumers against the real `ff_dev` resources, whereas
# `ff_prod` is reached exclusively from inside AWS (the EC2 instance profile).
#
# Terraform creates the identity but never its credential. The access key is created by hand in the IAM
# console after `apply`, then mounted into the cluster as a k8s Secret. `aws_iam_access_key` would have put
# the secret access key into HCP state; encrypted at rest, but a long-lived credential in state is worth
# avoiding when the alternative is one manual step. This mirrors the secrets above: the local Terraform IAM
# user creates containers and identities, and handles no credential material of any kind.
#
# Consequence: `force_destroy` is left unset, so a `terraform destroy` while the hand-made key still exists
# fails with a DeleteConflict. Delete the access key first. Setting `force_destroy = true` would trade that
# step for a much wider set of `iam:List*` / `iam:Delete*` grants on the Terraform user.

module "solana_register_consumer_policy" {
  source = "../modules/solana_register_consumer_policy"

  queue_arns = [
    module.solana_register_registrants_queue.queue_arn,
    module.solana_register_registrants_confirmed_queue.queue_arn,
  ]
  table_arn = module.solana_register_registrations_table.table_arn
  secret_arns = [
    aws_secretsmanager_secret.solana_register_deployer_keypair.arn,
    aws_secretsmanager_secret.solana_register_rpc_url.arn,
  ]
  event_bus_arn = aws_cloudwatch_event_bus.solana_register.arn
}

resource "aws_iam_user" "solana_register_local_runtime" {
  name = "${local.name_prefix}_solana_register_local_runtime"
}

resource "aws_iam_user_policy" "solana_register_local_runtime" {
  name   = "${local.name_prefix}_solana_register_consumer"
  user   = aws_iam_user.solana_register_local_runtime.name
  policy = module.solana_register_consumer_policy.policy_json
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

output "solana_register_local_runtime_user_name" {
  description = "IAM user the local KIND consumers authenticate as; its access key is created by hand"
  value       = aws_iam_user.solana_register_local_runtime.name
}

output "solana_register_local_runtime_user_arn" {
  description = "ARN of the local KIND runtime IAM user"
  value       = aws_iam_user.solana_register_local_runtime.arn
}
