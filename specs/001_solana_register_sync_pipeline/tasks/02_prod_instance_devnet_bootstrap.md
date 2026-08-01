# 02 — Bootstrap the prod register instance on devnet

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The prod register instance is live on devnet under its own program id, with its IDL published and its own
`registry_state` PDA initialised to the deployer as authority — mirroring the existing manual dev ceremony, and
documented so it can be repeated.

## Depends on

- 01

## Changes

- `fragments/blockchain/solana/scripts/bootstrap_register_devnet.ts` — parameterise the program id and IDL path via
  environment variables (e.g. `REGISTER_PROGRAM_ID`, `REGISTER_IDL_PATH`), defaulting to the committed dev IDL so the
  existing documented invocation keeps working unchanged.
- `fragments/blockchain/solana/scripts/devnet.example.env` — document the new variables.
- `README.md` — a new "prod devnet bootstrap" section mirroring the existing dev one, and both program ids recorded
  alongside each other.

The ceremony itself (run manually, not in CI, per ADR 009): `anchor build --program-name register -- --features prod` →
`solana program deploy --program-id ./target/deploy/register-prod-keypair.json` → `anchor idl init` → run the
parameterised bootstrap script to call `initialise_registry`.

**No separate prod IDL is committed.** The prod build overwrites `target/idl/register.json` in place, changing only its
`.address` (the instructions, discriminators and account layouts are identical to the dev IDL — it's the same source).
Committing a second, renamed copy would create a file Anchor never emits, which drifts on the next program change, and
nothing consumes it: `solana_program_utils.ts` imports the IDL only for discriminators (structure, dev/prod-identical),
the interface functions take `programAddress` as a parameter, and CI uploads the IDL it builds on the fly, never a
committed one. The prod id's source of truth is `declare_id!` in `lib.rs`; the README mirrors it; consumers get it from
per-env config. So after the ceremony, **restore the committed IDL to the dev one** — rebuild the default
(`anchor build --program-name register`) or `git checkout` the file — before committing anything from this task.

## Verification (QA)

- Node.js quality checks, `tsc`, `deno lint`, `deno fmt` — see the `build` skill.
- `solana program show <prod id>` reports the deployer as upgrade authority.
- `anchor account register.RegistryState <prod registry_state pda> --provider.cluster <helius url>` shows
  `authority = <deployer>` and `registration_count = 0`.
- The dev instance is untouched: `anchor account register.RegistryState <dev registry_state pda>` still reports its
  existing `registration_count`.

## Definition of done

- A second (prod) register instance is deployed on devnet under its own id, its IDL is published on-chain, and its
  `registry_state` is initialised with the deployer as authority.
- The two instances have independent state — confirming a registration on one leaves the other unchanged.
- `bootstrap_register_devnet.ts` is parameterised and its default behaviour is unchanged.
- The README documents the prod bootstrap and both program ids.
- The committed `target/idl/register.json` is restored to the **dev** id after the ceremony (`git status` clean for that
  path); no prod IDL file is added.
