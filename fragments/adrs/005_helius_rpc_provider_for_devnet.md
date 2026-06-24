# Use Helius as the Solana RPC provider for devnet

**Status:** Accepted | **Date:** 2026-06-24

## Context and Problem Statement

Deploying and operating the [`register`](../blockchain/solana/programs/register/) program on Solana `devnet` — both the
manual bootstrap and the automated [`solana_deploy.yml`](../../.github/workflows/solana_deploy.yml) upgrade workflow —
requires an RPC endpoint to send transactions, deploy bytecode, upload IDLs, and query account state. The default public
`https://api.devnet.solana.com` endpoint is rate-limited, which can make program deploys (high transaction volume) and
CI runs less reliable. What RPC endpoint should the devnet deploy and bootstrap paths use?

## Considered Options

- The default public devnet RPC (`https://api.devnet.solana.com`)
- A managed RPC provider — [Helius](https://www.helius.dev/) (`https://devnet.helius-rpc.com/?api-key=<key>`)

## Decision Outcome

Chosen option: "Helius managed RPC", because it gives a more reliable endpoint behind a single API key with no node
operation overhead — the decisive factor for both program deploys and CI upgrades.

Helius is a Solana-native infrastructure provider (founded 2022) that runs the nodes so we don't have to: RPC nodes,
transaction sending, gRPC streaming, webhooks, and digital asset APIs, used by teams such as Phantom, Jupiter and
Coinbase. It is the "managed node" layer — instead of provisioning and babysitting validators/RPC nodes, we hit their
HTTP/WebSocket endpoints with an API key.

The API key is referenced from three places, never committed:

- [`solana-cli.devnet.yml`](../blockchain/solana/solana-cli.devnet.example.yml) — for `solana` / `anchor` CLI commands
  during the manual bootstrap (duplicated from the `.example.yml`, then the key added).
- [`scripts/devnet.env`](../blockchain/solana/scripts/devnet.example.env) — for the
  [`bootstrap_register_devnet.ts`](../blockchain/solana/scripts/bootstrap_register_devnet.ts) one-shot initialisation
  script (duplicated from `devnet.example.env`).
- The `HELIUS_API_KEY` secret on the `ff_solana_devnet` GitHub environment — the
  [`solana_deploy.yml`](../../.github/workflows/solana_deploy.yml) workflow stores the key only and constructs the RPC
  URL at run time.

The public devnet RPC was rejected because its rate limits make deploys and CI less reliable, and Helius's managed
endpoint removes that friction without any node-operation overhead.

### Consequences

- Good, because deploys and CI upgrades get a more reliable endpoint than the rate-limited public RPC
- Good, because there is zero node-operation overhead — no validator/RPC infrastructure to provision, fund, or maintain
- Good, because access reduces to a single API key, cleanly injectable per context (CLI config, `.env`, CI secret) and
  kept out of version control via the `.example` templates
- Bad, because it introduces a third-party dependency and vendor lock-in for the devnet path — a Helius outage or key
  revocation blocks deploys and upgrades
- Bad, because the API key is a long-lived shared credential spread across three locations (local CLI config, local
  `.env`, GH secret), so rotation means updating each
- Bad, because the chosen Helius plan carries its own usage limits; sustained or heavier usage may require an upgrade

## More Information

- Helius: <https://www.helius.dev/>
- Devnet bootstrap and upgrade procedures are recorded under [`README.md` → Solana → Devnet](../../README.md#devnet)
  (manual bootstrap) and [Devnet upgrades (CI/CD)](../../README.md#devnet-upgrades-cicd)
- The devnet upgrade workflow [`solana_deploy.yml`](../../.github/workflows/solana_deploy.yml) requires the
  `HELIUS_API_KEY` and `SOLANA_DEVNET_UPGRADE_AUTHORITY` secrets on the `ff_solana_devnet` GitHub environment
- Templates that must be duplicated and populated with the key:
  [`solana-cli.devnet.example.yml`](../blockchain/solana/solana-cli.devnet.example.yml) and
  [`scripts/devnet.example.env`](../blockchain/solana/scripts/devnet.example.env)
