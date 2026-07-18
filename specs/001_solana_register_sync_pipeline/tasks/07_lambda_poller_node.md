# 07 — Lambda poller (Node.js)

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A Node.js handler that ingests **at most one registration per invocation** by walking the contiguous registration index
against the DynamoDB watermark, and publishes it to the EventBridge bus. Pure code plus unit tests — no infrastructure.

## Depends on

- 04, 05 (the table shape and the event envelope)

## Changes

- New fragment directory `fragments/solana_register_sync/` with `poller.ts` and `poller.test.ts`.
- `package.json` — add `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-eventbridge`,
  `@aws-sdk/client-secrets-manager`.
- Reuse `fragments/solana_program_register/solana_register_interface.ts` for `getRegistryStateAccount`, and
  `fragments/env_vars/env_vars_utils.ts` for configuration.

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

- Node.js unit tests, `tsc`, `deno lint`, `deno fmt` — see the `build` skill. AWS clients and the RPC client are mocked.
- Test cases: `count == watermark` no-ops; `count > watermark` ingests exactly one and advances by one; an
  already-recorded registrant publishes without creating a second row; a failed conditional watermark update does not
  publish twice within one invocation; a backlog of N drains one-per-invocation over N invocations.

## Definition of done

- The handler ingests at most one registration per invocation and advances the watermark by exactly one.
- The `memcmp` filter targets offset 40 with a little-endian u64, matching the on-chain `Registration` layout.
- A retry between publish and watermark advance cannot produce a duplicate DynamoDB row.
- Unit tests cover the no-op, single-ingest, duplicate-registrant and backlog-drain paths.
- Node.js tests, typecheck, lint and format pass.
