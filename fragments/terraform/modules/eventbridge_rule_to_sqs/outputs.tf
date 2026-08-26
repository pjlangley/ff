output "rule_name" {
  description = "Name of the rule"
  value       = aws_cloudwatch_event_rule.to_queue.name
}

output "rule_arn" {
  description = "ARN of the rule; the queue policy grants send permission only to this ARN"
  value       = aws_cloudwatch_event_rule.to_queue.arn
}
