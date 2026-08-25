output "table_name" {
  description = "Name of the registrations table"
  value       = aws_dynamodb_table.this.name
}

output "table_arn" {
  description = "ARN of the registrations table"
  value       = aws_dynamodb_table.this.arn
}
