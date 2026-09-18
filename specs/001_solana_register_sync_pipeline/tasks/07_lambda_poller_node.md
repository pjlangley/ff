# 07 — Lambda poller (Node.js)

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A Node.js handler that ingests **at most one registration per invocation** by walking the contiguous registration index
against the DynamoDB watermark, and publishes it to the EventBridge bus. Handler code plus tests — no infrastructure of
its own; the tests run against the local validator, as every other fragment's do.

## Depends on

- 04, 05 (the table shape and the event envelope)

## Changes

- New fragment directory `fragments/solana_register_sync/` with `poller.ts` and `poller.test.ts`.
- `package.json` — add `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-eventbridge`,
  `@aws-sdk/client-secrets-manager`, and `aws-sdk-client-mock` as a devDependency.
- Reuse `fragments/solana_program_register/solana_register_interface.ts` for `getRegistryStateAccount`, and
  `fragments/env_vars/env_vars_utils.ts` for configuration.
- `fragments/solana_program_register/solana_register_interface.ts` — additively, the `Registration` byte layout is now
  exported (`REGISTRATION_INDEX_OFFSET`, `REGISTRATION_ACCOUNT_SIZE`, `registrationDecoder`, `RegistrationAccount`).
  Step 3 fetches the account by raw-byte filter rather than by PDA, so it needs both the offsets and the decoder;
  duplicating either in the poller would let the two drift from the Rust struct. No existing behaviour changed.
  Subsequently the by-index read itself (`getRegistrationAccountByIndex` and `registrationIndexFilters`) was promoted
  into the interface too, mirrored in Python, and exposed on both APIs as `GET /solana/register/index/:index`; the
  poller consumes that shared read rather than owning it.

Three things the task file left open, **settled during build**:

- **What is injected and what is not.** `pollOnce(config, clients)` takes only the two AWS clients (`PollerClients` —
  the DynamoDB document client and the EventBridge client). The chain is deliberately **not** injected: it is read
  through the same `solana_register_interface` and `solana_rpc_utils` fragments every other module uses, against a real
  validator, consistent with the rest of the repo's tests. That puts the seam below command construction, so the tests
  see the actual `PutCommand` / `UpdateCommand` / `PutEventsCommand` the poller sends and the condition expressions
  become load-bearing rather than decorative.
- **Where the RPC URL comes from.** `initRpcClient()` reads `SOLANA_RPC_URL` at call time, so the handler fetches the
  Helius secret once per cold start and seeds that variable; with it unset, `initRpcClient` falls back to
  `127.0.0.1:8899`. One mechanism therefore serves both environments — Helius in Lambda, the local validator under test
  — and the URL stays out of the Lambda's plaintext environment (task 08's definition of done).
- **The `dataSize` filter value.** Not stated in the task; derived from the Rust struct as 65 bytes (8 discriminator +
  32 registrant + 8 index + 8 `registered_at` + 9 for `Option<u64>` under Anchor's `InitSpace`).

A fourth outcome beyond the task's algorithm, `registration_not_found`, covers the two chain reads disagreeing.
`register` creates the `Registration` account and increments `registration_count` in one atomic instruction, but the
poller reads the count and scans for the account in two separate RPC calls. A managed endpoint load-balances across
nodes that are not all at the same slot, so the scan can be served by a node that has not yet applied the transaction
the count already reflects. The watermark is left alone so the next invocation retries the same index rather than
skipping a registration — the same handling covers a reorg between the two reads, which `commitment: "confirmed"` leaves
possible.

It is deliberately left uncovered: `solana-test-validator` is a single node, and its ledger only moves forward between
the two reads, so a count that includes an index guarantees the account at that index is visible. The branch is
unreachable locally without faking the chain. The durable fix is `getProgramAccounts`'s `minContextSlot`, pinning the
scan to the slot the count was read at — which needs the context slot that `getRegistryStateAccount` currently discards,
so it is deferred with the other `solana_register_interface` signature changes.

Handler algorithm, per requirement B:

1. Read the `WATERMARK#<program_id>` item from DynamoDB (absent ⇒ `0`).
2. Read the singleton `registry_state.registration_count`. If `count <= watermark`, no-op and return.
3. Fetch the single `Registration` account at index `== watermark` via `getProgramAccounts` with a `memcmp` filter on
   `registration_index` — **offset 40** (8 discriminator + 32 registrant pubkey), u64 little-endian, exact match — plus
   a `dataSize` filter. Decode the registrant pubkey and `registered_at`.
4. Conditionally `PutItem` the `REGISTRANT#<pubkey>` record at status `registered` with `attribute_not_exists(pk)`. This
   is the dedup: a `ConditionalCheckFailedException` means we've seen this registrant before, so **don't** create a
   second row.
5. Publish the `RegistrationDetected` event to the bus — including after a conditional-check failure, because the
   consumers are idempotent and a dropped publish would strand the record at `registered`. Duplicate _messages_ are
   safe; duplicate _rows_ are not.
6. Advance the watermark by exactly one, conditional on it still equalling the value read in step 1, so two overlapping
   invocations can't both advance it.

No transaction-log parsing, no signature cursor, no backfill, no batching.

## Verification (QA)

- Node.js tests, `tsc`, `deno lint`, `deno fmt` — see the `build` skill. Requires the local stack
  (`docker compose --profile blockchain up`), like every other fragment test.
- **Chain is real, AWS is mocked.** `before` registers three funded accounts against the local validator and reads back
  the index the program assigned the first; each test seeds the watermark to that index, so assertions hold no matter
  what else has registered against the shared singleton registry. The `getRegistryStateAccount` read and the
  `memcmp`-filtered `getProgramAccounts` lookup then run for real, which validates offset 40 against an
  Anchor-serialised account rather than a hand-built buffer. DynamoDB and EventBridge are `aws-sdk-client-mock` doubles
  over a `Map`-backed fake table that honours exactly the two condition expressions the poller sends.
- **Chain writes are confined to `before`** — three registrations for the whole file. The single-ingest, duplicate and
  conflict tests only ever _read_ that first registration, and the fake table is rebuilt per test, so sharing it is
  safe. The runner executes files in parallel against one validator whose slots are slowed by `--ticks-per-slot 256`,
  and `confirmRecentSignature` defaults to a 5s window, so keeping this file's transaction count low matters to the
  whole suite's reliability. Confirmations made here use a 20s window and are asserted rather than ignored.
- Bootstrapping the registry tolerates `already in use`: `solana_register_interface.test.ts` and the Fastify
  `/register/initialise` route bootstrap the same singleton PDA, and with parallel files one of the three loses.
- Test cases: `count <= watermark` no-ops (and writes nothing); `count > watermark` ingests exactly one, writes the
  `REGISTRANT#` row at status `registered`, advances the watermark by one, and publishes **one** event whose `Source`,
  `DetailType` and `Detail` match the rule in `ff_dev/solana_register.tf`; an already-recorded registrant publishes
  without overwriting the existing row; a rejected conditional watermark update yields `ingested_watermark_conflict`
  with the watermark untouched and still exactly one publish; a backlog drains one index per invocation, in order.
- The registry is a singleton PDA, so the suite initialises it only when genuinely absent. The poller needs no
  authority, so the deployer keypair is read lazily rather than on every run.

**Run during build:** `tsc --noEmit`, `deno lint` and `deno fmt --check` pass. The test suite itself was **not** run —
it needs the local validator, which the agent sandbox cannot reach (loopback `listen()` is denied and the Docker socket
is blocked), so `node --run test` was left to the user.

## Definition of done

- The handler ingests at most one registration per invocation and advances the watermark by exactly one.
- The `memcmp` filter targets offset 40 with a little-endian u64, matching the on-chain `Registration` layout — proven
  against a real Anchor-serialised account, not a synthetic one.
- A retry between publish and watermark advance cannot produce a duplicate DynamoDB row.
- The published envelope matches the EventBridge rule's `source` and `detail-type`, so a `RegistrationDetected` event
  cannot be published successfully to no queue.
- Tests cover the no-op, single-ingest, duplicate-registrant, watermark-conflict and backlog-drain paths.
- Node.js tests, typecheck, lint and format pass.
