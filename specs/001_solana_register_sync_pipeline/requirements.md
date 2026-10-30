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
  AWS, ~~mirrored in Node.js and Python~~ in Node.js (see [Revisions](#revisions)), with a working local (KIND) loop and
  a cheap cloud (k3s) deployment.
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

### D. Kubernetes processing services (~~mirrored Node.js + Python~~ Node.js)

- A **registrants consumer** reads the registrants SQS queue, ~~upserts the record into DynamoDB, then~~ signs
  `confirm_registration` on-chain with the deployer authority, reconciling `confirmed_at` from on-chain truth and
  treating `RegistrationAlreadyConfirmed` as success (idempotent), then marks the poller's record `confirmed`. _No
  upsert: the poller commits the record before publishing the event, so it exists for every message (task 09)._
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
- ~~Both consumer roles are implemented in **both Node.js and Python**, deployed as **competing consumers** (SQS
  load-balances between them — the repo's round-robin/parity goal).~~ Both consumer roles are implemented in
  **Node.js**, each deployed with **`replicas: 2`** as **competing consumers** on its queue — SQS load-balances between
  the replicas, so concurrency, duplicate delivery and idempotency are exercised exactly as two languages would have
  exercised them.
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
- A **simple, native disconnect** enforces that invariant, ~~wrapped in a one-command script / Make target (e.g.
  `dev-cloud up|down|pause|resume`)~~ as README steps (revised 2026-10-15, see [Revisions](#revisions)). SQS consumers
  are pull-based (no trigger to disable), so the consumer itself is the only thing to switch:
  - ~~**Default posture:** keep the `ff_dev` EC2 **stopped** (`aws ec2 stop-instances`) — local KIND is the daily
    driver. Start it (`aws ec2 start-instances`) only to rehearse the cloud path, and pause local KIND during that
    window.~~ **Default posture:** the `ff_dev` EC2 runs on its weekday schedule (see G) and is the `ff_dev` consumer
    runtime. Local KIND is a test bench for local changes: stop the EC2 (`aws ec2 stop-instances`) before bringing KIND
    up; starting it again afterwards is optional, as the schedule starts it the next weekday morning.
  - ~~**In-session toggle:** if the EC2 is already up, **scale the consumer Deployments to zero** on the cluster to
    silence (`kubectl scale deploy … --replicas=0`, back to the base replica count, `2`, to resume) — no app code, no
    queue reconfiguration.~~ Stopping the EC2 replaces scaling to zero: a stopped instance comes back on schedule by
    itself, while a scale-to-zero would persist across restarts until undone.
- `ff_prod` does not require local access.

### G. Terraform (both roots)

- Add per-environment resources to `ff_dev/` and `ff_prod/`: DynamoDB table, Lambda + EventBridge Scheduler + custom
  bus + rules → existing SQS queues, Secrets Manager secret, IAM, and a **single small EC2 running k3s** (+ security
  group / instance profile). **Both** environments provision the k3s-on-EC2 cluster so the cloud deployment can be
  verified in `ff_dev` before `ff_prod` (symmetric envs, simpler promotion). Follow existing conventions (`name_prefix`,
  `default_tags`, shared modules where sensible).
- ~~The `ff_dev` EC2 is intended to run **on demand** (default state: stopped) — it exists to rehearse the cloud path,
  not to run 24/7 — keeping cost low and avoiding queue contention with local KIND (see F). No overnight schedule is
  needed for `ff_dev` (it's disconnected by default).~~ The `ff_dev` EC2 runs on the same weekday schedule as `ff_prod`
  (revised 2026-10-15, see [Revisions](#revisions)).
- **~~`ff_prod`~~ Overnight pause (cost control), in both environments:** a second **EventBridge Scheduler** pair uses
  the templated `ec2:StopInstances` / `ec2:StartInstances` targets (no Lambda) on `Europe/London` time to stop ~~the
  `ff_prod` EC2~~ each environment's EC2 overnight and start it in the morning, aligned with the poller window (B) so
  producer and consumers wake together: start 07:45, stop 17:00, Monday to Friday. Safe because the cluster is stateless
  and SQS is durable; the auto-assigned public IP changes on restart ~~, so the start helper refreshes the kubeconfig
  endpoint~~, which affects nothing because the Kubernetes API is not reached from the laptop (revised 2026-10-30, see
  [Revisions](#revisions)) (no Elastic IP — it carries a standing charge).
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
- A Python mirror of the consumers (see [Revisions](#revisions)).
- Running the poller locally / iterating on poller logic locally (poller always in AWS this iteration).
- Backfill / cold-start ingestion and per-poll batching (the poller ingests at most one registration per poll).
- Mainnet (devnet is the de-facto prod network for this portfolio).
- Observability/tracing tooling (acknowledged as a later addition that will support the non-deterministic ~~node/python
  round-robin~~ distribution of messages across competing replicas).

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
- ~~Both Node.js and Python consumers can process messages from the same queues (competing consumers) with equivalent
  results.~~ Two replicas of each consumer process messages from the same queue (competing consumers) with no
  double-confirmation, no duplicate rows and no lost signature.
- The local KIND loop runs consumers against real `ff_dev` AWS resources with credentials supplied as a k8s Secret and
  the deployer keypair sourced from Secrets Manager.
- The same pipeline runs on the `ff_dev` k3s-on-EC2 cluster (rehearsing the cloud deploy before prod)~~, and the
  disconnect toggle (stop-instance or scale-to-zero) hands the `ff_dev` queues cleanly between the cloud cluster and
  local KIND with no double-processing~~. Stopping its EC2 hands the `ff_dev` queues to local KIND.
- The ~~`ff_prod`~~ overnight schedule, in both environments, stops the EC2 and windows the poller (`Europe/London`);
  after a pause, a registration made during the down window is picked up and processed on resume with no loss and no
  manual intervention.
- `terraform plan/apply` succeeds for `ff_dev` and `ff_prod` with the new resources; `deno fmt`/`cargo fmt`/`tf fmt` and
  the repo's lint/type/test checks pass.

## Open questions

- Exact k8s manifest tooling (plain manifests vs kustomize overlays) — to settle in `spec-tasks`; Helm is excluded
  regardless.
- Poller schedule cadence and the exact daytime window hours — tune during build (batch size is fixed at one
  registration per poll this iteration, so throughput is bounded by the poll interval).
- The exact set of downstream services that would subscribe to confirmed registrations (via EventBridge fan-out) — out
  of scope now; `audited` is the terminal state of the one audit subscriber this iteration builds.

## Revisions

- **2026-09-28 — Python consumers dropped (during task 09).** The consumers were to be mirrored in Python and compete
  with the Node.js ones for the repo's comparison goal. Dropped because:
  - The repo's own API surface convention (`build` skill) classes a consumer loop as a deployment surface, not a
    capability — the same reasoning that already kept the poller Node.js-only. The Python side of the chain capability
    is mirrored where it belongs, in `solana_register_interface.py` and the FastAPI routes.
  - Parity was the cost, not the learning: behavioural equivalence across the condition expressions, the `ALL_OLD`-based
    missing-vs-audited distinction, the signature write rule and `RegistrationAlreadyConfirmed` detection (whose error
    shape differs in `solana-py`), with no shared type to catch envelope drift. A divergence would have made outcomes
    depend on which language received a message.
  - The competing-consumers learning survives intact: `replicas: 2` produces the same SQS semantics and the same races,
    which come from concurrency, not from language.

  Tasks 11 and 12 are dropped; tasks 13–16 narrow to the Node.js image and two Deployments. Python remains a candidate
  for a future feature with a smaller parity surface.

- **2026-10-15 — the `ff_dev` cloud cluster becomes the default runtime; KIND becomes a test bench (after task 14's
  build).** KIND was to be the daily driver, with the `ff_dev` EC2 stopped by default and a `dev-cloud` toggle script
  handing the queues between them. Revised because:
  - The cloud path is the one being learned and operated, so it should be what normally runs in `ff_dev`. KIND's value
    is testing local changes (an image built from the working tree) before they reach `ff_dev`.
  - The `ff_dev` EC2 runs on the poller's weekday window, start 07:45 and stop 17:00 Monday to Friday (`Europe/London`),
    the same as `ff_prod`. Costs are monitored and the window adjusted if needed.
  - With KIND used only now and then, the toggle's jobs shrink to stopping the EC2 first, which is one README command.
    Its guard against both runtimes running is dropped; leaving KIND up when the schedule next starts the instance is an
    accepted risk for a portfolio project.
  - The plain-command preference also applies to KIND itself: `kind.sh` is replaced by README steps.

  The scheduled stop/start pair and its ADR move from task 17 into task 15's shared `k3s_node` module, so both
  environments get it from one place. Task 16 is dropped. The kubeconfig refresh it owned (the public IP changes on
  every start) moves into task 15's README.

- **2026-10-30 — no laptop `kubectl` for the cloud clusters; the kubeconfig refresh is dropped (before task 15's
  build).** The refresh existed only so `kubectl` on the laptop could follow the EC2's auto-assigned public IP, which
  changes on every scheduled start. The cluster itself never needed it: pods reach the API in-cluster and AWS through
  egress. Revised because:
  - The cloud clusters run unattended on their schedule, so laptop access to the Kubernetes API is rarely needed, and a
    daily refresh chore (plus the API certificate not covering the public IP) is cost without a matching use.
  - Operator access becomes a shell on the node through AWS Systems Manager Session Manager, running k3s's bundled
    `kubectl` against its local kubeconfig. The security group drops all ingress (no 6443, no SSH, no `admin_cidr`), and
    the instance profile gains `AmazonSSMManagedInstanceCore`.

  Tasks 15 and 17 drop the refresh and its verification. Laptop `kubectl` (for example through a Session Manager
  port-forward) can be added later if a need appears.
