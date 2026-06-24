# Use upgradeable (upgrade-in-place) Solana programs rather than immutable

**Status:** Accepted | **Date:** 2026-06-24

## Context and Problem Statement

When a Solana program is deployed via the BPF Upgradeable Loader it retains an upgrade authority, allowing the bytecode
to be replaced in place at the same program ID. That authority can be revoked at any time to make the program immutable.
We need to decide whether our devnet programs (e.g. [`register`](../blockchain/solana/programs/register/)) keep their
upgrade authority or are made immutable.

## Considered Options

- Keep the programs upgradeable (retain the upgrade authority)
- Make the programs immutable (revoke the upgrade authority after deploy)

## Decision Outcome

Chosen option: "Keep the programs upgradeable", because this is an educational project where the program logic is
expected to change frequently, and upgrading in place preserves the stable program ID along with all derived PDAs and
on-chain state. Immutability would force a redeploy to a new program ID on every change, cascading into updated client
configuration, re-initialised state, and lost accounts — unwanted complexity for no real benefit here. Retaining the
upgrade authority is also common practice for actively developed programs.

### Consequences

- Good, because iterative development keeps a stable program ID, so client config, PDAs, and on-chain state survive each
  upgrade.
- Bad, because the upgrade authority keypair is a trust/security concern — whoever holds it can replace the bytecode. On
  devnet this is acceptable; a production deployment would warrant tighter authority management (e.g. a multisig) or
  eventual immutability.

## More Information

See the [Devnet upgrades (CI/CD)](../../README.md#devnet-upgrades-cicd) section of the README for the automated upgrade
workflow that relies on the retained upgrade authority.
