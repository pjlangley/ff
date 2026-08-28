# The runtime permissions one consumer process needs, emitted as a policy document rather than a policy
# resource: the same grants are carried by two different identities - the local KIND runtime's IAM user
# (`ff_dev`) and the k3s EC2 instance profile - so the caller decides what to attach the document to.
#
# Every statement is scoped to the exact ARNs passed in, which is tighter than the `{env}_*` prefix: the
# consumers only ever touch the resources of their own environment's pipeline.
data "aws_iam_policy_document" "consumer" {
  statement {
    sid    = "SqsConsumeRegisterQueues"
    effect = "Allow"

    # Receive + delete is the whole consumer loop; `GetQueueAttributes` covers the SDK's queue metadata
    # reads (visibility timeout, message counts). No `SendMessage` - producers publish to the bus, and the
    # rules deliver, so no consumer addresses a queue directly.
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]

    resources = var.queue_arns
  }

  statement {
    sid    = "DynamoDbRegistrationRecords"
    effect = "Allow"

    # Upsert the registration record and mark it audited. No `Query` or `Scan`: the table's hash key is the
    # whole key, so every access is by `pk`. No `DeleteItem`: records are terminal at `audited`.
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ]

    resources = [var.table_arn]
  }

  statement {
    sid       = "SecretsManagerReadStartupSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = var.secret_arns
  }

  statement {
    sid    = "EventBridgePublishToRegisterBus"
    effect = "Allow"

    # The registrants consumer publishes `RegistrationConfirmed` after the on-chain write lands.
    actions   = ["events:PutEvents"]
    resources = [var.event_bus_arn]
  }
}
