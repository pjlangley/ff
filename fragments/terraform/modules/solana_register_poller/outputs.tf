output "function_name" {
  description = "Name of the poller Lambda"
  value       = aws_lambda_function.poller.function_name
}

output "function_arn" {
  description = "ARN of the poller Lambda"
  value       = aws_lambda_function.poller.arn
}

output "role_arn" {
  description = "ARN of the poller's execution role"
  value       = aws_iam_role.poller.arn
}

output "log_group_name" {
  description = "CloudWatch log group the poller writes its per-invocation summary to"
  value       = aws_cloudwatch_log_group.poller.name
}

output "schedule_name" {
  description = "Name of the EventBridge Scheduler schedule that invokes the poller"
  value       = aws_scheduler_schedule.poller.name
}

output "schedule_arn" {
  description = "ARN of the EventBridge Scheduler schedule"
  value       = aws_scheduler_schedule.poller.arn
}
