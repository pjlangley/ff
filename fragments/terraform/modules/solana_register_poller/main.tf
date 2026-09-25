# The ingestion half of the register pipeline: the Node.js poller on a cron, publishing to the bus.
#
# Instantiated once per environment with that environment's on-chain instance and AWS resources, so the
# two pipelines never share a function, a role or a watermark.
#
# The bundle is *not* built here. `node --run solana_register_sync:build` writes it with esbuild and
# Terraform only zips it, which keeps the toolchains apart: `terraform plan` never shells out to npm, and
# the same artifact is consumed by a local `ff_dev` run and by an HCP runner (which cannot build it - see
# the bundle_path variable and `terraform_deploy.yml`).

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

locals {
  function_name = "${var.name_prefix}_${var.name}"
  log_group_arn = "arn:aws:logs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.function_name}"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# `output_path` sits under the root module rather than this one: both workspaces instantiate this module,
# and a shared path inside `modules/` would have them writing over each other's zip.
data "archive_file" "poller" {
  type = "zip"

  # `source_file` puts the file at the archive root under its own basename, and Lambda resolves `handler`
  # against that root - so the bundle has to be called `index.js` for `index.handler` to find it.
  source_file = var.bundle_path
  output_path = "${path.root}/.terraform_lambda/${local.function_name}.zip"
  # The bundle's mode follows whoever built it (a developer's umask, or the CI runner's). Pinning it keeps
  # the zip - and therefore `source_code_hash` - identical across machines, so a plan from CI and a plan
  # from a laptop agree.
  output_file_mode = "0644"
}

# --- function identity
#
# Every grant is scoped to the exact ARNs passed in, matching the consumer policy's posture: the poller
# only ever touches its own environment's pipeline.

data "aws_iam_policy_document" "assume_lambda" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "poller" {
  statement {
    sid    = "DynamoDbWatermarkAndRecords"
    effect = "Allow"

    # `GetItem` reads the watermark, `PutItem` creates the REGISTRANT# record under its
    # `attribute_not_exists` dedup, `UpdateItem` advances the watermark. No `Query`/`Scan` - the table's
    # hash key is the whole key - and no `DeleteItem`.
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ]

    resources = [var.table_arn]
  }

  statement {
    sid       = "EventBridgePublishRegistrationDetected"
    effect    = "Allow"
    actions   = ["events:PutEvents"]
    resources = [var.event_bus_arn]
  }

  statement {
    sid       = "SecretsManagerReadRpcUrl"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.rpc_url_secret_arn]
  }

  statement {
    sid    = "CloudWatchLogsWrite"
    effect = "Allow"

    # No `logs:CreateLogGroup`: the group is Terraform-managed below so its retention is set from the
    # start. Without the grant the function cannot silently create an unmanaged, never-expiring one.
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${local.log_group_arn}:*"]
  }
}

resource "aws_iam_role" "poller" {
  name               = local.function_name
  description        = "Execution role for the ${local.function_name} Lambda"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

resource "aws_iam_role_policy" "poller" {
  name   = local.function_name
  role   = aws_iam_role.poller.id
  policy = data.aws_iam_policy_document.poller.json
}

# --- function

resource "aws_cloudwatch_log_group" "poller" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "poller" {
  function_name = local.function_name
  description   = "Ingests at most one register registration per invocation and publishes it to the bus"
  role          = aws_iam_role.poller.arn

  filename = data.archive_file.poller.output_path
  # Compared against the deployed function's recorded hash, so an unchanged bundle is not re-uploaded.
  source_code_hash = data.archive_file.poller.output_base64sha256

  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]

  timeout     = var.timeout
  memory_size = var.memory_size

  environment {
    variables = {
      SOLANA_REGISTER_PROGRAM_ID = var.program_id
      REGISTRATIONS_TABLE_NAME   = var.table_name
      EVENT_BUS_NAME             = var.event_bus_name
      EVENT_SOURCE               = var.event_source
      HELIUS_RPC_URL_SECRET_ID   = var.rpc_url_secret_arn
    }
  }

  # Lambda creates its own log group on first invocation if one does not exist, and that group has no
  # retention. Ordering the managed group first is what keeps `var.log_retention_days` load-bearing.
  depends_on = [aws_cloudwatch_log_group.poller]
}

# --- schedule
#
# EventBridge Scheduler rather than an `aws_cloudwatch_event_rule` schedule: it evaluates the cron in a
# named timezone, so the daytime window holds across a BST/GMT transition without editing the expression.

data "aws_iam_policy_document" "assume_scheduler" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    # Without this, any account's schedule could be pointed at this role - the confused deputy.
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "scheduler_invoke" {
  statement {
    sid       = "InvokePoller"
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.poller.arn]
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.function_name}_scheduler"
  description        = "Invoke role EventBridge Scheduler assumes to call ${local.function_name}"
  assume_role_policy = data.aws_iam_policy_document.assume_scheduler.json
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "${local.function_name}_scheduler"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_invoke.json
}

resource "aws_scheduler_schedule" "poller" {
  name        = local.function_name
  description = "Daytime cron for the ${local.function_name} Lambda"

  # OFF, not FLEXIBLE: the poller ingests one registration per invocation, so the interval between
  # invocations is the pipeline's throughput. A jittered start would make that interval non-deterministic
  # for no benefit.
  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = aws_lambda_function.poller.arn
    role_arn = aws_iam_role.scheduler.arn

    # The schedule is itself the retry: a failed invocation is picked up by the next tick, which re-reads
    # the watermark and retries the same index. Scheduler's defaults (185 attempts over 24h) would keep
    # retrying long past that, so retries are capped well inside one interval.
    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 300
    }
  }
}
