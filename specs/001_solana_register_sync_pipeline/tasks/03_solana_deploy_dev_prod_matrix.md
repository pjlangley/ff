# 03 — `solana_deploy.yml` dev/prod matrix

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The devnet deploy workflow upgrades **both** register instances from a single run via a `{dev, prod}` matrix, building
each with the right feature and resolving the right program id.

## Depends on

- 01, 02 (the workflow performs upgrades only — the prod instance must already exist on-chain)

## Changes

- `.github/workflows/solana_deploy.yml`:
  - Add a `strategy.matrix.environment: [dev, prod]` to the `deploy` job, with the `--features prod` build flag applied
    only for the prod leg.
  - **Move the "resolve program ID from IDL" step to _after_ the build step.** It currently reads the committed
    `target/idl/register.json` before building; under feature flags the correct id is only in the IDL that the matching
    build just regenerated.
  - Raise `DEPLOY_MIN_SOL` from `3` to `6` (both instances upgrade from the one deployer balance).
  - ~~Scope `concurrency.group` per matrix leg so the two legs don't cancel each other.~~ **Not done — the premise
    doesn't hold.** Workflow-level `concurrency` gates the whole _run_, so the legs of a single run were never in
    contention; and per-leg groups actively break the shared-keypair guarantee (a newer run's dev leg is free to start
    while an older run's prod leg is still upgrading). The workflow-level group is kept as-is, and
    `strategy.max-parallel: 1` serialises the legs within a run — together, exactly one leg holds the deployer keypair
    at any time.
  - `anchor upgrade` and `anchor idl upgrade` continue to consume the freshly built `target/deploy/register.so` and
    `target/idl/register.json`. The prod leg therefore generates and uploads the **prod** IDL on the fly from the
    `--features prod` build — no committed prod IDL is needed or read (see task 02). The committed IDL in the checkout
    is only the `changes`-filter trigger and the dev-structure reference; the build overwrites it before either `jq` or
    `anchor idl upgrade` touches it.

## Verification (QA)

- Trigger the workflow from a change under `programs/register/**` and confirm both matrix legs run green.
- The balance preflight passes against the raised `DEPLOY_MIN_SOL`; top the deployer up via the faucet first if needed.
- Each leg's deployment summary reports a **different** program id, matching the two ids recorded in the README.
- `solana program show` on both ids reports the new deploy slot.

## Definition of done

- One workflow run upgrades both the dev and prod register instances, each with the correct feature build and program
  id.
- The raised balance preflight passes, and its failure summary still names the deployer address and faucet.
- The prod leg publishes the prod IDL; the dev leg publishes the dev IDL. Neither overwrites the other.
