resource "aws_sqs_queue" "dlq" {
  name = "${var.name_prefix}_${var.name}_dlq"
}

resource "aws_sqs_queue" "main" {
  name = "${var.name_prefix}_${var.name}"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.max_receive_count
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "dlq" {
  queue_url = aws_sqs_queue.dlq.url

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.main.arn]
  })
}
