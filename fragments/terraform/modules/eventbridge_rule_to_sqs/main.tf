# Routes one event envelope (`source` + `detail-type`) from a custom bus to one SQS queue.
#
# Producers publish to the bus and never address a queue directly, so a new subscriber attaches as its own
# rule + queue (fan-out) rather than competing on an existing queue.
#
# The queue policy below is the queue's *whole* policy - `aws_sqs_queue_policy` writes the queue's `Policy`
# attribute, so it owns it outright. That holds because the fan-out design gives each subscriber its own
# queue, and therefore each queue exactly one rule. A second rule targeting the same queue would need the
# two grants merged into a single policy document instead of a second instance of this module.
resource "aws_cloudwatch_event_rule" "to_queue" {
  name           = var.name
  description    = var.description
  event_bus_name = var.event_bus_name

  event_pattern = jsonencode({
    source        = [var.event_source]
    "detail-type" = [var.detail_type]
  })
}

resource "aws_cloudwatch_event_target" "queue" {
  rule           = aws_cloudwatch_event_rule.to_queue.name
  event_bus_name = var.event_bus_name
  target_id      = var.name
  arn            = var.queue_arn
}

# Scoped to this rule's ARN, not to `events.amazonaws.com` at large: without the condition any EventBridge
# rule in any account could send to the queue.
data "aws_iam_policy_document" "queue" {
  statement {
    sid    = "AllowEventBridgeRuleSendMessage"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [var.queue_arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.to_queue.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "queue" {
  queue_url = var.queue_url
  policy    = data.aws_iam_policy_document.queue.json
}
