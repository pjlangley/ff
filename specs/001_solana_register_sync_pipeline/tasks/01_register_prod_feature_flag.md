# 01 — Feature-flagged `declare_id!` for a prod register instance

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The `register` program builds under two identities: the default build keeps the existing dev id
(`DPEfE7E9LExX61taVQRQHpxZGkFEKLzRqwfCDMtzFg2K`), and `--features prod` swaps in a newly generated prod id. Nothing is
deployed in this task.

## Depends on

- none

## Changes

- `fragments/blockchain/solana/programs/register/Cargo.toml` — add a `prod` feature to the existing `[features]` block.
- `fragments/blockchain/solana/programs/register/src/lib.rs` — cfg-gate the `declare_id!` invocation:

  ```rust
  #[cfg(not(feature = "prod"))]
  declare_id!("DPEfE7E9LExX61taVQRQHpxZGkFEKLzRqwfCDMtzFg2K");
  #[cfg(feature = "prod")]
  declare_id!("<new prod id>");
  ```

- Generate the prod program keypair with `solana-keygen new -o fragments/blockchain/solana/register_prod-keypair.json`.
  It is already gitignored by the `**/*-keypair.json` rule. Back it up outside the repo — though note it is only needed
  for the **initial** deploy (it fixes the program address); subsequent upgrades are authorised by the deployer keypair,
  so losing it after task 02 is survivable.
- New ADR via `/new-adr`: two on-chain instances of one program via feature-flagged `declare_id!`, sharing a single
  upgrade authority.

`Anchor.toml`'s `[programs.localnet] register` entry stays on the dev id — the local validator only ever runs the
default build.

## Verification (QA)

- `anchor build --program-name register` — the emitted `target/idl/register.json` carries the **dev** id.
- `anchor build --program-name register -- --features prod` — the emitted IDL carries the **prod** id.
- Rust unit tests (`cargo test -p program-tests`), `cargo clippy`, `cargo fmt` — see the `build` skill.
- `deno fmt` for the new ADR and the README index.

## Definition of done

- A `prod` feature exists in `programs/register/Cargo.toml`.
- The default build resolves to the dev program id; the `prod` feature build resolves to the new prod program id.
- The prod program keypair is generated and lives outside version control.
- After re-running the **default** build, the committed `target/idl/register.json` is unchanged (`git status` clean for
  that path) — the committed IDL remains the dev one.
- Rust tests, clippy and formatting pass.
- The ADR is accepted and the root `README.md` decision-record index is updated.
