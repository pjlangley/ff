output "queue_arn" {
  description = "ARN of the source queue"
  value       = aws_sqs_queue.main.arn
}

output "queue_url" {
  description = "URL of the source queue"
  value       = aws_sqs_queue.main.url
}

output "queue_name" {
  description = "Name of the source queue"
  value       = aws_sqs_queue.main.name
}

output "dlq_arn" {
  description = "ARN of the dead-letter queue"
  value       = aws_sqs_queue.dlq.arn
}

output "dlq_url" {
  description = "URL of the dead-letter queue"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_name" {
  description = "Name of the dead-letter queue"
  value       = aws_sqs_queue.dlq.name
}
