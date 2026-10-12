# 10 — Confirmed consumer / auditor (Node.js)

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A long-running Node.js service that drains the confirmed queue and acts as an independent auditor: it re-derives truth
from the chain, cross-checks it against the central DynamoDB record, and marks the record `audited` only on a match.

## Depends on

- 09

## Changes

- `fragments/solana_register_sync/confirmed_consumer.ts` (+ `.test.ts`).
- `fragments/solana_register_sync/shared.ts` (+ `.test.ts`) — added during build, see _Settled during build_.
- `fragments/solana_register_sync/confirmed_consumer.example.env`, a `solana_register_sync:confirmed_consumer` script in
  `package.json`, and a _Run the confirmed consumer_ section in the root `README.md` (under _Solana register sync
  pipeline_) — mirroring task 09.

Behaviour:

- Per message, take **only the registrant pubkey** from the event payload. Everything else is re-derived: load the
  DynamoDB record, and load the on-chain `Registration` PDA via `getRegistrationAccount`.
- Cross-check that `registrant`, `registration_index` and `confirmed_at` all agree, and that the PDA's `confirmed_at` is
  actually set. Deliberately do not trust the event's own copy of these fields — that is the point of the audit.
- On a match: set status `audited` with an audited timestamp, publish nothing, delete the message.
- On a mismatch: throw. The message is not deleted, it retries, and after `maxReceiveCount` it lands in the confirmed
  queue's DLQ for inspection. Log enough to diagnose which field diverged.

This is the terminal state of the one audit subscriber in this iteration. Further subscribers would attach as their own
EventBridge rule and queue, not by competing on this one.

**Carried over from task 09 (added during its build):** give the auditor the same receive loop as
`registrants_consumer.ts`'s `consume`, including its fixed cadence:

- **One poll cycle every `POLL_INTERVAL_SECONDS`**: same name, same default (1800s, from
  `DEFAULT_POLL_INTERVAL_SECONDS`) and same validation (unset or empty means the default, `0` means back-to-back polls,
  anything but a non-negative integer fails startup). Each cycle handles at most one message, then sleeps whatever the
  queue holds. Both consumers then read one ConfigMap key and can be tuned together for testing.
- The rest of the loop shape: one message per receive (`MaxNumberOfMessages: 1`, 20s long poll), a failed receive that
  just ends the cycle (no separate backoff), and an `AbortSignal` that cancels the long poll and the sleep but never an
  in-flight message.
- Read the payload through `RegistrationConfirmedDetail` from `events.ts`. Its `signature` is `null` when the
  registrants consumer found the registration already confirmed; the audit ignores it either way.
- Derive the record's key with `registrantKey` from `registrations_table.ts`, not a third private copy. Tests spell
  `REGISTRANT#<pubkey>` out by hand, as `poller.test.ts` and `registrants_consumer.test.ts` do.

Whether to extract the loop into a shared helper (e.g. `consume(config, signal, handleMessage)`) or keep a second copy
is a build-time call. Two consumers is the point where the duplication starts to cost; a shared loop would also keep the
interval and shutdown tests in one place.

Settled during build:

- **The loop was extracted, with the rest of what both consumers do identically, into `shared.ts`:**
  `consumeQueue(config, sqs, signal, handleMessage)` (the handler returns its success log line, so each consumer keeps
  its own `outcome` — `confirmed` / `audited`), `DEFAULT_POLL_INTERVAL_SECONDS` and `readPollIntervalSeconds`,
  `parseDetail` (the detail-type and `program_id` envelope check, parameterised by detail-type), `requireEnvVar`,
  `readSecretString` / `seedSolanaRpcUrl`, and the `SIGTERM`/`SIGINT` `shutdownSignal`. `registrants_consumer.ts` was
  refactored onto it with no change in behaviour; its `consume` is now a thin wrapper. The loop's contract tests
  (cadence, one message per cycle, shutdown, surviving a failed receive or handler) moved to `shared.test.ts`, driven by
  a stub handler — the loop never touches the chain, so ADR 013 is unaffected — and each consumer keeps one `consume`
  wiring test.
- **Not shared:** `waitForSignature` / `confirmOnChain` (the auditor sends no transaction, so has no signature to wait
  on), and each consumer's `createAwsClients` and config (different client sets). `poller.ts` keeps its own
  `requireEnvVar`: it is esbuild-bundled into the Lambda, and `shared.ts` would pull the SQS client in with it. The
  chain test fixtures (`registerOne`, `confirmOrFail`, the registry-init race) are now in three test files; sharing them
  is left as a follow-up.
- **Configuration:** `SOLANA_REGISTER_PROGRAM_ID`, `CONFIRMED_QUEUE_URL`, `REGISTRATIONS_TABLE_NAME`,
  `HELIUS_RPC_URL_SECRET_ID` and the optional `POLL_INTERVAL_SECONDS`. No deployer keypair — the auditor only reads the
  chain. Startup reads `registry_state` to fail fast on a wrong RPC URL or program id.
- **The record is read with `ConsistentRead`.** The registrants consumer writes `confirmed` seconds before this event
  arrives; an eventually consistent read could return the `registered` row and fail a healthy message.
- **The `audited` write is conditional on the values just cross-checked**
  (`registrant = :registrant AND registration_index = :registration_index AND confirmed_at = :confirmed_at`), so a
  record changed between the read and the write is not audited — the message throws and retries. The comparisons also
  fail on a missing item, so no partial row is ever created.
- **Replays re-audit.** An already `audited` record is re-checked and, on a match, keeps its first `audited_at`
  (`if_not_exists`); only `updated_at` moves.
- **Mismatch logging:** the thrown error names each diverged field with both values, e.g.
  `registration_index record=6 chain=5`, and lands in the loop's `failed` log line.

## Verification (QA)

- Node.js unit tests, `tsc`, `deno lint`, `deno fmt` — see the `build` skill. Requires the local stack
  (`docker compose --profile blockchain up`).
- **Chain is real, AWS is mocked.** AWS clients (SQS, DynamoDB) are `aws-sdk-client-mock` doubles; the `Registration`
  PDA is read from the local validator, as in task 07 — see the `build` skill's testing conventions (ADR 013).
- Test cases: matching record and PDA → `audited`; a `registration_index` mismatch → throws, no status change; a PDA
  with `confirmed_at` unset → throws; a missing DynamoDB record → throws. Added during build: a `confirmed_at` mismatch;
  the event's own fields are ignored; a record changed between cross-check and write; a replay keeps `audited_at`;
  another program / detail-type is rejected; `consume` wiring.
- Locally against `ff_dev`: a real registration flows through to `audited`.

## Definition of done

- A confirmed registration is verified against the on-chain PDA and marked `audited`.
- A DynamoDB↔on-chain mismatch does not audit the record; the message retries and reaches the DLQ.
- The auditor re-reads the chain rather than trusting the event payload.
- Node.js tests, typecheck, lint and format pass.
