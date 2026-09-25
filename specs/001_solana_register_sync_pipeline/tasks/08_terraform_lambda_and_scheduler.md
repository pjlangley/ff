# 08 — Lambda + EventBridge Scheduler (chain to queue, end to end)

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The poller runs in AWS on a daytime schedule, so registering a test account on devnet results in a message landing on
the registrants queue with no manual step. This is the first end-to-end slice: chain → queue.

## Depends on

- 04, 05, 06, 07

## Changes

- Lambda packaging: bundle `poller.ts` to a single file and zip it with Terraform's `archive_file` data source.
  `esbuild` as a new devDependency is the cleanest route; reusing the existing `tsc` output plus production
  `node_modules` also works but produces a much larger artifact. **Decide at build time.**
- `fragments/terraform/ff_dev/` and `ff_prod/`:
  - `aws_lambda_function` (Node.js 22 runtime, `architectures = ["arm64"]` — Graviton Lambda is cheaper per GB-second
    and the bundle is pure JavaScript, so there is no native-module reason to stay on x86_64). Its IAM role and policy:
    DynamoDB read+write on the table, `events:PutEvents` on the bus, `secretsmanager:GetSecretValue` on the Helius
    secret, and CloudWatch Logs.
  - `aws_cloudwatch_log_group` with a short retention (cost).
  - `aws_scheduler_schedule` with a cron expression and `schedule_expression_timezone = "Europe/London"` so the daytime
    window is DST-safe, plus its invoke role. Flexible time window off.
  - Lambda environment: table name, bus name, program id, Helius secret ARN.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with Lambda, IAM role, Scheduler and Logs actions
  scoped to `ff_dev_*`.

**Open at build time:** the exact cron cadence and window hours. Throughput is bounded by the poll interval since the
poller ingests one registration per invocation, so pick a cadence that drains a small backlog within the window.

### Settled during build

- **Packaging: esbuild, bundled as CJS.** A plain **ESM** bundle does not run. The dependency graph contains CJS-only
  packages that call `require()` at runtime, and in an ESM output file `require` does not exist, so the bundle dies at
  import with `Dynamic require of "node:https" is not supported` (reproduced locally before any Terraform was written).
  `--format=cjs` with `handler = "index.handler"` loads cleanly. esbuild is a direct devDependency, pinned at `^0.28.2`
  (current latest); `tsx` keeps its own nested 0.23.1 because it pins `~0.23.0`, and the two coexist.
  `node --run solana_register_sync:build` is the entry point. Artifact: 2.7 MB unminified, ~504 KB zipped. Left
  unminified deliberately, so CloudWatch stack traces stay readable — the cold-start saving from minifying is not worth
  losing that on a nine-invocations-a-weekday function.
  - Two follow-ups checked afterwards, neither of which changes the decision. **ESM is reachable** with a `--banner:js`
    that rebuilds `require` from `node:module`'s `createRequire` (verified to load), but nothing here asks for it — no
    top-level await, no ESM-only dependency — so CJS stays as the artifact with one less moving part. And the problem is
    **not** esbuild's: pointing it at the AWS SDK's ESM builds with `--main-fields=module,main` trims the bundle to 1.9
    MB and still fails, on `Dynamic require of "events"` instead. Any bundler needs the same shim, so **swc is not an
    alternative** — quite apart from swc having no bundler to offer (`spack`/`swcpack` is deprecated and dropped in v2,
    its docs redirecting to Parcel 2 / Turbopack / Rspack). Dropping the bundler entirely would mean transpiled output
    plus production `node_modules`, i.e. the larger artifact this task already rejected.
- **Where the bundle lives, and who builds it.** `ff_prod`: that workspace uses **remote** execution, and
  `terraform_deploy.yml` uploads `fragments/terraform` to HCP from a bare `actions/checkout`. An `archive_file` source
  must therefore sit inside that directory and exist at upload time, and the HCP runner has no Node.js toolchain to
  build it with. Settled as: the bundle is written to `fragments/terraform/lambda_dist/solana_register_poller/index.js`
  and **gitignored**, and `terraform_deploy.yml` gains a `setup-node` + `npm ci` +
  `node --run solana_register_sync:build` step before the upload. Committing the artifact was rejected — a generated 2.7
  MB file in git goes stale silently whenever `poller.ts` changes.
  - Consequence: a `terraform plan` in either root needs `node --run solana_register_sync:build` run first.
    `terraform validate` does not — it never evaluates data sources — so `terraform.yml` is unchanged.
  - Same commit widens `terraform_deploy.yml`'s `paths-filter`, which watched only `ff_prod/**` and `modules/**`. A
    change to the poller's source is now a change to what `ff_prod` deploys, so it has to trigger the workflow. Settled
    as `fragments/**` with `!fragments/terraform/ff_dev/**` excluded, plus `package.json` / `package-lock.json` —
    **not** an enumeration of the bundle's inputs. An enumeration was written first and rejected on review: the set of
    paths that affect the artifact is not knowable from the import graph, because `solana_program_utils` imports the
    four program IDLs and whether they reach the bundle depends on which survive esbuild's tree-shaking. They contribute
    **0 bytes** today (the poller only takes read paths, so `getInstructionDiscriminator` is shaken out) and would start
    counting the moment the poller touches a write path — a silent staleness the enumeration could not defend against.
    The exclusion requires `predicate-quantifier: "some-with-excludes"`; under the default `'some'` a `!` pattern is
    **not** subtractive and the filter matches anyway.
  - Safe to be coarse because the filter is a cost optimisation, not a gate. Verified: `archive_file` zeroes every zip
    entry's mtime (`fh.SetModTime(time.Time{})`), and `output_file_mode` is pinned, so an unchanged bundle yields a
    byte-identical zip and an unchanged `source_code_hash` despite esbuild rewriting the file each run; an empty plan
    then finishes as `planned_and_finished`, so the `apply` job's `run_status == 'planned'` gate skips it, behind the
    `ff_prod` approval environment as well. Over-triggering costs one no-op HCP run; under-triggering would leave prod
    silently on stale code.
- **Shared module.** The two roots instantiate an identical function + schedule, so the resources live in
  `fragments/terraform/modules/solana_register_poller/` alongside the other shared modules, parameterised by program id
  and cron. `output_path` for the zip is derived from `path.root`, not `path.module`, so the two workspaces do not write
  over each other's archive; it lands in `<root>/.terraform_lambda/` (gitignored, and `.terraformignore`d for
  `ff_prod`).
- **Cron cadence, chosen by the user:** `cron(0 8-16 ? * MON-FRI *)` in `Europe/London` — hourly, 08:00 to 16:00
  inclusive, weekdays only. Nine invocations a weekday. Because the poller ingests at most one registration per
  invocation, this also caps ingestion at **nine registrations a weekday**; a larger backlog drains over subsequent
  windows, which the state-reconciliation design tolerates.
- **Prod IAM reference policies, beyond the stated scope.** The `Changes` list names only
  `ff_dev/tf_local_iam_policy.json`, but tasks 04, 05 and 06 each extended `ff_prod/tf_remote_iam_plan_policy.json` and
  `tf_remote_iam_apply_policy.json` in the same commit as the resources they added. This task follows that precedent:
  Lambda, IAM role, Scheduler and Logs actions scoped to `ff_prod_*`, read-only on the plan role. Without them the first
  `ff_prod` apply (task 17) would fail on `AccessDenied` rather than on anything task 17 changed.
- **`logs:DescribeLogGroups` cannot be resource-scoped.** Found by a failed `ff_dev` apply, not by review: the first cut
  scoped it to `log-group:/aws/lambda/ff_dev_*` alongside the other Logs actions, and the provider's read-back of
  `aws_cloudwatch_log_group` was denied. AWS evaluates the call against
  `arn:aws:logs:eu-west-2:<account_id>:log-group::log-stream:` — an **empty** group name, because it is a list-style API
  with no specific group in the authorization context — so no name-prefixed pattern can ever match. The Service
  Authorization Reference confirms it is the one Logs action this task uses that declares no resource type at all;
  `DescribeLogStreams`, `FilterLogEvents`, `PutRetentionPolicy` and the rest all take `log-group`, and `GetLogEvents`
  takes `log-stream`. Moved into the pre-existing `Resource: "*"` statement, which is exactly that category already
  (`sqs:ListQueues`, `sts:GetCallerIdentity`); the Sid is renamed `ListAndDescribeWithoutResourceScope` now that three
  services share it. Same fix in all three policy documents. Every other action added by this task was re-audited
  against the reference — action-by-action for resource-type support, and ARN shape per resource type — and no other
  statement has the problem.
- **Retry policy.** Scheduler's default is 185 attempts over 24 hours, which for an hourly poller would still be
  retrying long after the next tick has re-read the watermark and retried the same index anyway. Capped at 2 attempts
  within 300 seconds — well inside one interval.
- **`aws_scheduler_schedule` is not taggable**, so the provider's `default_tags` block does not reach it. Every other
  resource this task adds is tagged as usual.

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`, `plan` clean for `ff_prod`.
- `aws lambda invoke` against a registry with no new registrations logs a no-op and publishes nothing.
- Register a test account against the **dev** program on devnet, then invoke the Lambda: a `RegistrationDetected` event
  is published and `aws sqs receive-message` returns it from `ff_dev_solana_register_registrants`.
- Invoke a second time: no new message, and the watermark item in DynamoDB is unchanged.
- CloudWatch Logs show the ingest and the watermark advance.

**Run during build:** `node --run solana_register_sync:build` (bundle written and smoke-tested — `require()`ing it
exposes `handler`, which fails fast with `Environment variable SOLANA_REGISTER_PROGRAM_ID is not set`),
`terraform fmt -check -recursive`, `node --run tsc`, `node --run lint`, `node --run format:check`. All pass.

**Not run — handed to the user.** Every `terraform` command that contacts a registry or HCP fails in the agent sandbox:
the filtering proxy's TLS interception is not trusted by the Terraform binary
(`tls: failed to verify certificate:
x509: OSStatus -26276`), and the AWS provider plugin cannot be launched locally
either, so even an offline `terraform validate` is unavailable. The new `hashicorp/archive` provider means
**`terraform init` must be re-run in both roots** to write it into `.terraform.lock.hcl` before anything else — that
lock file change is not in this diff. The `validate` / `plan` / `apply` and `aws lambda invoke` steps above are all
user-side.

## Definition of done

- The poller is deployed and invoked on an `Europe/London` daytime cron in both environments.
- A devnet registration is ingested and lands on the registrants queue without manual intervention.
- A second invocation with no new registrations is a clean no-op.
- The Lambda reads the Helius URL from Secrets Manager, not a plaintext env var.
- `terraform plan` succeeds for `ff_prod`.
- The `hashicorp/archive` provider is recorded in both roots' `.terraform.lock.hcl`.
