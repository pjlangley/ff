# DynamoDB as the central datastore for the register sync pipeline

**Status:** Accepted | **Date:** 2026-08-13

## Context and Problem Statement

The register sync pipeline (spec 001) needs a central, off-chain record of every on-chain registration: its index, when
it was registered and confirmed, its status through the pipeline, and the signatures that produced it. The same pipeline
also needs somewhere durable to keep the Lambda poller's **watermark** — the last-processed `registration_count` per
program — since that watermark is what makes ingestion resumable and idempotent. Which AWS datastore should hold both,
given the access pattern is a keyed lookup by registrant pubkey (never a query across registrants) and the traffic is a
handful of writes per day?

## Considered Options

- DynamoDB, on-demand (`PAY_PER_REQUEST`), single table shared by both item shapes
- RDS / Aurora Serverless (PostgreSQL)
- S3 objects keyed by registrant pubkey

## Decision Outcome

Chosen option: "DynamoDB on-demand, single table", because every access the pipeline performs is a point read or write
by a key it already holds — the registrant pubkey from the queue message, or the program id for the watermark — which is
exactly DynamoDB's primitive, and on-demand billing means an idle pipeline costs effectively nothing.

The table declares a single string hash key `pk` and nothing else; the remaining fields are schemaless. `pk` carries a
type prefix so two item shapes share one table:

- `REGISTRANT#<pubkey>` — `registration_index`, `registered_at`, `confirmed_at`, `status` (`registered` → `confirmed` →
  `audited`), source signatures and timestamps.
- `WATERMARK#<program_id>` — the poller's last-processed `registration_count`.

Co-locating the watermark with the records it produces is deliberate: the poller then needs exactly one table, one IAM
grant and one client, and a future move to a conditional write that advances the watermark and records the registrant
together stays available without a cross-service transaction.

RDS was rejected because there is no relational query to justify it — and an always-on instance (or an Aurora Serverless
v2 floor) is a standing monthly charge for a table that sees a few writes a day, which is the opposite of this project's
cost posture. S3 was rejected because the record is mutated repeatedly as it walks `registered → confirmed → audited`;
S3 has no conditional update on an attribute, so every transition would be a read-modify-write of a whole object with no
way to make it safe under concurrent consumers.

### Consequences

- Good, because on-demand billing scales to zero cost when the pipeline is idle — which is its default state, given the
  overnight pause and the on-demand `ff_dev` cluster
- Good, because point reads/writes by pubkey are the native access pattern, so no index design is needed and the table
  needs no capacity tuning
- Good, because a single string hash key keeps the table schemaless beyond the key, so item shapes can evolve with the
  consumers without a Terraform change
- Good, because one table for both records and watermark keeps the IAM grant, the client wiring and the operational
  surface small
- Neutral, because the type prefix on `pk` is a convention enforced by the consumers, not by the table — DynamoDB will
  happily accept a malformed key
- Bad, because ad-hoc analytical questions ("how many registrations are stuck at `registered`?") require a full scan or
  a secondary index that does not exist today; the table is built for the pipeline's access pattern, not for reporting

## More Information

- Module: [`modules/solana_registrations_table`](../terraform/modules/solana_registrations_table/main.tf)
- Instantiated per environment in [`ff_dev`](../terraform/ff_dev/solana_register.tf) and
  [`ff_prod`](../terraform/ff_prod/solana_register.tf), named from `local.name_prefix`
- Feature spec:
  [`specs/001_solana_register_sync_pipeline`](../../specs/001_solana_register_sync_pipeline/requirements.md) (section C)
  tasks 09–12.
