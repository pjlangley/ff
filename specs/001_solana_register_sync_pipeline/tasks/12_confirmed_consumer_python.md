# 12 — Confirmed consumer / auditor (Python)

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A Python mirror of the auditor, completing the four consumer services (two roles × two languages).

## Depends on

- 10 (mirrors it), 11

## Changes

- `fragments/solana_register_sync/confirmed_consumer.py` (+ `test_confirmed_consumer.py`).

Behaviour matches task 10 exactly: take only the registrant pubkey from the event; re-derive the DynamoDB record and the
on-chain `Registration` PDA; cross-check `registrant`, `registration_index` and `confirmed_at`, and that the PDA's
`confirmed_at` is set; mark `audited` on a match; raise on a mismatch so the message retries into the DLQ. Same
environment-variable names as the Node.js auditor.

## Verification (QA)

- Python unit tests, `mypy`, `pylint`, `ruff format` — see the `build` skill. Requires the local stack
  (`docker compose --profile blockchain up`).
- **Chain is real, AWS is mocked.** `boto3` clients (SQS, DynamoDB) are doubled; the `Registration` PDA is read from the
  local validator, as in task 07 — see the `build` skill's testing conventions (ADR 013).
- The same test cases as task 10: match → `audited`; index mismatch → raises; unset `confirmed_at` → raises; missing
  record → raises.
- Locally against `ff_dev`: a real registration reaches `audited`, and a forced mismatch reaches the DLQ without being
  audited.
- Both auditors running together: SQS load-balances and neither double-audits.

## Definition of done

- The Python auditor is behaviourally equivalent to the Node.js one.
- All four consumer services exist and pass their language's tests, typecheck, lint and format.
- Competing consumers across both languages produce equivalent results on both queues.
