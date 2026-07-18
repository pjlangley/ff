# 11 — Registrants consumer (Python)

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A Python mirror of the registrants consumer with equivalent behaviour, so the two languages can compete on the same
queue.

## Depends on

- 09 (mirrors it; the Node.js version defines the contract)

## Changes

- `fragments/solana_register_sync/__init__.py` and `registrants_consumer.py` (+ `test_registrants_consumer.py`).
- `pyproject.toml` — add `boto3` to `dependencies` and `boto3-stubs[dynamodb,sqs,events,secretsmanager]` to the dev
  group so `mypy` has types.
- Reuse `confirm_registration` and `get_registration_account` from
  `fragments/solana_program_register/solana_register_interface.py`.

Behaviour matches task 09 exactly: keypair from Secrets Manager at startup; long-poll receive; upsert; confirm on-chain;
`RegistrationAlreadyConfirmed` as success; reconcile `confirmed_at` from the PDA; publish `RegistrationConfirmed`;
delete on success only; `SIGTERM` finishes the in-flight message. Same environment-variable names as the Node.js
consumer so a single Kustomize ConfigMap serves both.

## Verification (QA)

- Python unit tests, `mypy`, `pylint`, `ruff format` — see the `build` skill. `boto3` and the register interface are
  mocked.
- The same test cases as task 09: happy path, already-confirmed, failed send leaves the message, idempotent re-process.
- Run locally against `ff_dev` and observe a registration reach `confirmed`.
- With both the Node.js and Python consumers running, send several registrations and confirm SQS load-balances them and
  both produce equivalent records.

## Definition of done

- The Python consumer is behaviourally equivalent to the Node.js one, sharing environment-variable names.
- Both languages process messages from the same queue as competing consumers with equivalent results.
- Python tests, typecheck, lint and format pass.
