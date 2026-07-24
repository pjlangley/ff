# Two on-chain `register` instances via feature-flagged `declare_id!`, sharing one upgrade authority

**Status:** Accepted | **Date:** 2026-07-23

## Context and Problem Statement

The register sync pipeline needs a **prod** register instance on devnet that is isolated from the existing **dev**
instance, so pipeline work (polling, consumers, DynamoDB sync) runs against prod state without disturbing the dev
instance used for day-to-day experimentation. Devnet is the de-facto prod network for this portfolio, so both instances
live on the same cluster and are distinguished only by program ID. How should a single `register` codebase produce two
independently-addressed, independently-stateful on-chain instances?

## Considered Options

- One codebase, two IDs via a feature-flagged `declare_id!` (`--features prod` swaps the id), sharing one upgrade
  authority
- Two separate program crates (a copy of `register` with its own id)

## Decision Outcome

Chosen option: "feature-flagged `declare_id!` with a shared upgrade authority", because it keeps one source of truth for
the program logic while giving each environment a distinct program ID and therefore a fully independent `registry_state`
PDA and account space. The default build keeps the dev id (`DPEfE7E9LExX61taVQRQHpxZGkFEKLzRqwfCDMtzFg2K`); building
`--features prod` resolves the new prod id (`61FGhEA7embzcojRPRf62ZCdLEcBP8fDeaafUFQxe7HR`). The local validator only
ever runs the default build, so `Anchor.toml`'s `[programs.localnet]` entry stays on the dev id.

A second program crate was rejected because it duplicates the logic and doubles the maintenance surface for what is the
same program.

The **deployer keypair remains the shared upgrade authority** for both instances, consistent with
[ADR 007](./007_upgradeable_solana_programs.md)–[009](./009_manual_bootstrap_initial_devnet_deploy.md). This is an
accepted trade-off: a single authority is simpler to custody in this educational context, at the cost of not modelling
separate dev/prod authority keys as a real production system would. The prod program keypair is generated once, used
only to fix the program address on the **initial** deploy, and kept outside version control (gitignored by
`**/*-keypair.json`); losing it after the initial deploy is survivable because subsequent upgrades are authorised by the
deployer keypair.

### Consequences

- Good, because there is one codebase and one set of logic to maintain, with the environment split expressed as a single
  cfg-gated `declare_id!`
- Good, because distinct program IDs give each environment a fully independent `registry_state` PDA and account space —
  true on-chain isolation
- Good, because the default build is unchanged, so the local validator and the committed dev IDL are untouched
- Neutral, because a shared upgrade authority does not model separate dev/prod key custody — but the target is devnet in
  an educational project, so the blast radius of a compromised deployer key is mostly risk-free. A real production
  app/program would **not** share one authority across environments; it would isolate dev and prod authorities (and,
  ideally, use a multisig/hardware-backed key).
- Bad, because the two ids must be kept in sync across the program source, the deploy matrix, and downstream consumers —
  a hard-coded id in one place can drift

## More Information

- Program source: [`register/src/lib.rs`](../blockchain/solana/programs/register/src/lib.rs) (cfg-gated `declare_id!`)
- Feature declaration: [`register/Cargo.toml`](../blockchain/solana/programs/register/Cargo.toml) (`prod` feature)
- Feature spec:
  [`specs/001_solana_register_sync_pipeline`](../../specs/001_solana_register_sync_pipeline/requirements.md)
- The manual prod bootstrap and the `{dev,prod}` deploy matrix that consume this decision follow in tasks 02 and 03 of
  the same spec.
