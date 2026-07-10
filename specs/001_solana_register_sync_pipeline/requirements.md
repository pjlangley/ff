# Solana register event sync pipeline (Kubernetes)

**Status:** Draft | **Created:** 2026-07-09

## Problem / product ask

The `register` Solana program is deployed on devnet with a two-phase model: anyone can permissionlessly `register`
(emitting `RegisteredEvent`), and the singleton authority can `confirm_registration` (emitting `ConfirmedEvent`). We
want to sync these on-chain events into a central AWS datastore (an off-chain audit of a decentralised, permissionless
registry) and write confirmations back on-chain so the central entity publicly, immutably acknowledges each registrant.

The primary learning goal is **introducing Kubernetes** (local KIND + a low-cost cloud cluster) into the portfolio,
alongside event-driven AWS glue (Lambda, EventBridge, SQS, DynamoDB, Secrets Manager) and the practice of managing a
decentralised app from a centralised entity. Cost is kept low and pragmatic.

## Users & goals

- **Me (aspiring platform-engineer):** stand up and operate a Kubernetes-based event processor that bridges Solana ↔
  AWS, mirrored in Node.js and Python, with a working local (KIND) loop and a cheap cloud (k3s) deployment.
- **Registrants (permissionless, on-chain):** register without centralised ID and receive a timely on-chain confirmation
  that the central entity has acknowledged them.
- **The central entity:** holds an auditable off-chain record of every registration and its confirmation.

## Requirements

### A. Second on-chain `register` instance (dev/prod isolation) — foundational

- Give the program a distinct ID per environment via a **feature-flagged `declare_id!`**: default build keeps the
  existing dev id (`DPEfE7…`); `--features prod` swaps to a new prod id. Add a `prod` feature to
  `programs/register/Cargo.toml`.
- Generate a **new prod program keypair**; the **deployer keypair remains the shared upgrade authority** for both
  instances (accepted trade-off; consistent with ADRs 007–009).
- Each instance has its own `registry_state` PDA and independent state → full dev/prod on-chain isolation, removing the
  cross-environment confirmation write race.
- **Manual prod bootstrap** mirroring the README devnet flow: build `--features prod` → deploy → `anchor idl init` →
  parameterised `bootstrap_register_devnet.ts` (program id / IDL via env) → `initialise_registry` stamps the deployer as
  prod registry authority.
- Extend `solana_deploy.yml` to a **`{dev,prod}` matrix** upgrading both instances (build with the right feature,
  resolve the correct id, `anchor upgrade` + `anchor idl upgrade`); initial prod deploy stays manual. **Raise
  `DEPLOY_MIN_SOL`** (~6) and keep the deployer funded.

### B. Registration ingestion (per environment)

- A **Node.js AWS Lambda poller**, triggered on a schedule via **EventBridge Scheduler**, ingests **at most one
  registration per poll** by walking the contiguous registration index against a DynamoDB watermark (state on **devnet
  via Helius** is the source of truth):
  - **Change gate:** read the singleton `registry_state.registration_count` and compare to the last-processed watermark
    in DynamoDB. The count is monotonic and indices are contiguous `[0, count)`, so `count > watermark` means the
    registration at index `== watermark` is the next one to process.
  - **Targeted fetch:** fetch that single `Registration` account via `getProgramAccounts` with a `memcmp` filter on
    `registration_index` (offset 40, u64 little-endian, exact match) — returning the registrant pubkey and its state
    directly.
  - **Advance:** enqueue that one registrant, then advance the watermark by exactly one. Any backlog drains one-per-poll
    over subsequent invocations; no full-table scan, no diff, and no backfill / cold-start handling this iteration.
- Ingestion is idempotent (dedup by registrant pubkey in DynamoDB) so a retry between enqueue and watermark advance
  cannot double-record.
- The emitted `RegisteredEvent` / `ConfirmedEvent` are retained for observability but are **not** required for the poll
  — no transaction-log parsing and no signature cursor.
- The poller's **EventBridge Scheduler** cron runs on a **daytime window** (`ScheduleExpressionTimezone: Europe/London`,
  DST-safe) in **both** environments — overnight registrations are simply ingested in the next active window, which the
  state-reconciliation design tolerates with no loss.
- New registrations are published as **structured events to a custom EventBridge bus**, routed by a rule to the existing
  `{env}_solana_register_registrants` SQS queue.

### C. Central datastore

- A **DynamoDB table per environment (on-demand)** holds registration records keyed by registrant pubkey:
  `registration_index`, `registered_at` (slot), `confirmed_at` (slot, null until confirmed), a status (`registered` →
  `confirmed` → `audited`), source signatures, and timestamps.
- The same table holds the poller's **last-processed `registration_count` watermark** per program.

### D. Kubernetes processing services (mirrored Node.js + Python)

- A **registrants consumer** reads the registrants SQS queue, upserts the record into DynamoDB, then signs
  `confirm_registration` on-chain with the deployer authority, reconciling `confirmed_at` from on-chain truth and
  treating `RegistrationAlreadyConfirmed` as success (idempotent).
- On success it publishes a **structured confirmed event via EventBridge**, routed to the
  `{env}_solana_register_registrants_confirmed` SQS queue.
- A **confirmed consumer** reads the confirmed queue and acts as an independent **auditor**: it loads the central
  DynamoDB record and the on-chain `Registration` PDA for that registrant and cross-checks they agree (`registrant`,
  `registration_index`, and `confirmed_at` all match, and the PDA's `confirmed_at` is set). On a match it marks the
  record `audited` (with an audited timestamp); on a mismatch it does **not** audit — it fails the message so it retries
  and ultimately lands in the DLQ for inspection. It deliberately re-derives truth from chain rather than trusting the
  event payload.
- This confirmed consumer is the **first subscriber** to confirmed registrations; the vision is that, in a real product,
  further services would act on a confirmed registration. Because the confirmed path already flows through
  **EventBridge**, additional subscribers attach as their own EventBridge rules → their own queues (fan-out), not by
  competing on this queue. Modelling those downstream services is out of scope for this iteration.
- Both consumer roles are implemented in **both Node.js and Python**, deployed as **competing consumers** (SQS
  load-balances between them — the repo's round-robin/parity goal).
- Services are **long-running, no public API** at this stage; reuse the existing Docker images / Dockerfiles for the
  container builds.

### E. Secrets & IAM

- Store the **devnet deployer keypair in AWS Secrets Manager**; consumers read it at startup — in cloud via the **EC2
  instance profile**, locally via a scoped **IAM user's access keys** mounted as a k8s Secret. The GitHub Actions secret
  remains for CI.
- Scoped IAM: Lambda (DynamoDB r/w, EventBridge put, outbound Helius), the k3s EC2 instance profile / local runtime user
  (SQS receive+delete, DynamoDB r/w, Secrets read, EventBridge put), all restricted to `{env}_*` resources. Expand
  `ff_dev`'s local IAM policy accordingly.

### F. Local environment (KIND) & dev cluster coordination

- A working **local KIND** environment runs the **consumers only** (poller stays in AWS this iteration), against the
  **real `ff_dev` AWS resources** (SQS, DynamoDB, EventBridge, Secrets) via scoped IAM user keys, and against the dev
  register instance on devnet. No LocalStack.
- Both local KIND and the `ff_dev` EC2 cluster (see G) can consume the same `ff_dev` queues, so the invariant is
  **exactly one consumer runtime attached to the `ff_dev` queue set at a time** (SQS competing-consumers — avoids
  non-deterministic runs).
- A **simple, native disconnect** enforces that invariant, wrapped in a one-command script / Make target (e.g.
  `dev-cloud up|down|pause|resume`). SQS consumers are pull-based (no trigger to disable), so the consumer itself is the
  only thing to switch:
  - **Default posture:** keep the `ff_dev` EC2 **stopped** (`aws ec2 stop-instances`) — local KIND is the daily driver.
    Start it (`aws ec2 start-instances`) only to rehearse the cloud path, and pause local KIND during that window.
  - **In-session toggle:** if the EC2 is already up, **scale the consumer Deployments to zero** on the cluster to
    silence (`kubectl scale deploy … --replicas=0`, back to `--replicas=1` to resume) — no app code, no queue
    reconfiguration.
- `ff_prod` does not require local access.

### G. Terraform (both roots)

- Add per-environment resources to `ff_dev/` and `ff_prod/`: DynamoDB table, Lambda + EventBridge Scheduler + custom
  bus + rules → existing SQS queues, Secrets Manager secret, IAM, and a **single small EC2 running k3s** (+ security
  group / instance profile). **Both** environments provision the k3s-on-EC2 cluster so the cloud deployment can be
  verified in `ff_dev` before `ff_prod` (symmetric envs, simpler promotion). Follow existing conventions (`name_prefix`,
  `default_tags`, shared modules where sensible).
- The `ff_dev` EC2 is intended to run **on demand** (default state: stopped) — it exists to rehearse the cloud path, not
  to run 24/7 — keeping cost low and avoiding queue contention with local KIND (see F). No overnight schedule is needed
  for `ff_dev` (it's disconnected by default).
- **`ff_prod` overnight pause (cost control):** a second **EventBridge Scheduler** pair uses the templated
  `ec2:StopInstances` / `ec2:StartInstances` targets (no Lambda) on `Europe/London` time to stop the `ff_prod` EC2
  overnight and start it in the morning, aligned with the poller window (B) so producer and consumers wake together.
  Safe because the cluster is stateless and SQS is durable; the auto-assigned public IP changes on restart, so the start
  helper refreshes the kubeconfig endpoint (no Elastic IP — it carries a standing charge).
- **SQS retention:** raise the registrants / confirmed queues' message-retention to the **14-day maximum** (extend the
  `sqs_queue_with_dlq` module) — cheap headroom so a longer pause can't expire an un-processed message and strand a
  record at `registered`.

### H. Documentation & decision records

- New README section for the **prod devnet bootstrap** (mirroring the existing one) and the two program ids.
- New **ADRs** (via `/new-adr`) for: two on-chain instances on one cluster with feature-flagged `declare_id!` + shared
  authority; local k8s KIND cluster with cloud resources; AWS event-based architecture with EventBridge; DynamoDB
  datastore choice; scheduled overnight pause of the poller and EC2s (`Europe/London`) as a cost-saving approach.

## Non-goals / out of scope

- Helm (raw manifests / kustomize overlays only).
- EKS (using k3s-on-EC2 for cost); webhooks/websockets (polling only this iteration).
- A public-facing API or UI, and a wallet-based registration UI.
- A Python mirror of the Lambda poller (single scheduled trigger → Node.js only).
- Running the poller locally / iterating on poller logic locally (poller always in AWS this iteration).
- Backfill / cold-start ingestion and per-poll batching (the poller ingests at most one registration per poll).
- Mainnet (devnet is the de-facto prod network for this portfolio).
- Observability/tracing tooling (acknowledged as a later addition that will support the non-deterministic node/python
  round-robin).

## Acceptance criteria

- A second (prod) register instance is deployed on devnet under its own id, bootstrapped, with its own initialised
  `registry_state`; `solana_deploy.yml` upgrades both dev and prod via matrix and passes the raised balance preflight.
- Registering a test account against the dev program results, end to end, in: the Lambda poller emitting an EventBridge
  event → registrants SQS → a KIND consumer writing a DynamoDB record → `confirm_registration` landing on-chain
  (`confirmed_at` set) → a confirmed EventBridge event → confirmed SQS → the confirmed consumer verifying the DynamoDB
  record against the on-chain `Registration` PDA and marking the record `audited`.
- A confirmed consumer that finds a DynamoDB↔on-chain mismatch does not mark the record `audited`; the message retries
  and eventually reaches the confirmed queue's DLQ.
- Re-processing the same registration is idempotent (no duplicate DynamoDB rows; `RegistrationAlreadyConfirmed` handled
  as success).
- Both Node.js and Python consumers can process messages from the same queues (competing consumers) with equivalent
  results.
- The local KIND loop runs consumers against real `ff_dev` AWS resources with credentials supplied as a k8s Secret and
  the deployer keypair sourced from Secrets Manager.
- The same pipeline runs on the `ff_dev` k3s-on-EC2 cluster (rehearsing the cloud deploy before prod), and the
  disconnect toggle (stop-instance or scale-to-zero) hands the `ff_dev` queues cleanly between the cloud cluster and
  local KIND with no double-processing.
- The `ff_prod` overnight schedule stops the EC2 and windows the poller (`Europe/London`); after a pause, a registration
  made during the down window is picked up and processed on resume with no loss and no manual intervention.
- `terraform plan/apply` succeeds for `ff_dev` and `ff_prod` with the new resources; `deno fmt`/`cargo fmt`/`tf fmt` and
  the repo's lint/type/test checks pass.

## Open questions

- Exact k8s manifest tooling (plain manifests vs kustomize overlays) — to settle in `spec-tasks`; Helm is excluded
  regardless.
- Poller schedule cadence and the exact daytime window hours — tune during build (batch size is fixed at one
  registration per poll this iteration, so throughput is bounded by the poll interval).
- The exact set of downstream services that would subscribe to confirmed registrations (via EventBridge fan-out) — out
  of scope now; `audited` is the terminal state of the one audit subscriber this iteration builds.
