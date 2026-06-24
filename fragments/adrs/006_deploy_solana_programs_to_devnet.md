# Deploy Solana programs to devnet (not testnet)

**Status:** Accepted | **Date:** 2026-06-24

## Context and Problem Statement

The `register` program needs a public Solana cluster to deploy to (manual bootstrap plus CI/CD upgrades). Solana offers
two non-mainnet public clusters — `devnet` and `testnet` — and we need to pick one as the deployment target.

## Considered Options

- `devnet`
- `testnet`

## Decision Outcome

Chosen option: "`devnet`", because it is the conventional target for application/program developers and offers a more
stable, reliable environment with a dependable faucet. `testnet` is where core contributors stress-test validator
release candidates, so it resets and misbehaves more often. The choice is also reinforced by our RPC provider:
[Helius](https://www.helius.dev/) (see [005](./005_helius_rpc_provider_for_devnet.md)) points only at mainnet and devnet
endpoints, not testnet.

### Consequences

- Good, because devnet's stability and reliable faucet suit iterative program development and deployment.
- Good, because it aligns with our Helius RPC setup, which has no testnet endpoint.
- Bad, because we don't exercise programs against validator release candidates ahead of mainnet — acceptable, since that
  is not a goal of this educational project.

## More Information

See the [Devnet](../../README.md#devnet) section of the README for the manual bootstrap and the
[Devnet upgrades (CI/CD)](../../README.md#devnet-upgrades-cicd) section for the automated upgrade workflow.
