output "policy_json" {
  description = "Consumer IAM policy document, ready to attach to an IAM user policy or an EC2 instance role"
  value       = data.aws_iam_policy_document.consumer.json
}
