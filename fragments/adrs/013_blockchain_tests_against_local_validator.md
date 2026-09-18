# Test blockchain integrations against the local validator, mock AWS SDK clients

**Status:** Accepted | **Date:** 2026-09-18

## Context and Problem Statement

The Node.js and Python fragments that talk to Solana (`fragments/solana_*` and, since spec 001, the
`fragments/solana_register_sync` handlers) have always been tested against the local validator from
`docker compose --profile blockchain up`. The register sync pipeline adds a second kind of integration to the same
modules: AWS SDK calls to DynamoDB, EventBridge, SQS and Secrets Manager. Building the Lambda poller (spec 001, task 07)
showed the convention had never been written down — it had to be re-derived mid-build, and the still-unbuilt consumer
tasks had been planned with the register interface mocked. The question this record settles is: **which side of an
integration may a test double replace?**

## Considered Options

- Mock everything — pure unit tests with the chain and AWS both stubbed
- Real chain and real AWS — LocalStack locally, or the `ff_dev` account
- Real chain, AWS SDK clients mocked at the client boundary

## Decision Outcome

Chosen option: "real chain, AWS SDK clients mocked at the client boundary", because the validator is already running for
every other fragment and costs nothing extra, while replicating AWS locally is out of scope for this project.

The chain is never doubled. `initRpcClient` / `init_rpc_client`, the `@solana/kit` and `solana-py` RPC clients, and the
`solana_*_interface` fragments are exercised for real. Anything that would only be proven by a hand-built account buffer
— the `memcmp` offset the poller filters on, Anchor's serialisation of an `Option<u64>`, the `SOLANA_RPC_URL` fallback
to `127.0.0.1:8899` — is instead proven against an account the deployed program actually wrote. The "unit" tests are
therefore integration tests in unit-test clothing, and are run that way both locally and in CI, where
`.github/workflows/apis.yml` starts the `pjlangley/ff_solana` validator as a service container.

AWS clients are injected and replaced with doubles (`aws-sdk-client-mock` in Node.js; the `boto3` equivalent in Python).
The seam sits below command construction, so a test sees the actual `PutCommand` / `UpdateCommand` / `PutEventsCommand`
a module sends and can pin its condition expressions and event envelope — the parts that carry the correctness argument
— rather than a wrapper that hides them.

Mocking everything was rejected because it removes the only cheap on-chain validation the project has; real AWS was
rejected because it either adds a LocalStack service the stack does not otherwise need, or couples every test run to a
live account and its credentials.

### Consequences

- Good, because a module that integrates with the chain is proven against the deployed program, not a synthetic account,
  so byte-layout and serialisation mistakes fail a test instead of surfacing on devnet
- Good, because the same RPC URL plumbing serves tests, the local APIs and the Lambda — there is no test-only code path
  through the chain
- Good, because AWS doubles sit at the SDK boundary, so the commands, condition expressions and envelopes a module sends
  are asserted rather than decorative
- Neutral, because the tests require the local stack to be up (`docker compose --profile blockchain up`) — locally and
  in CI — and cannot run in an environment that cannot reach it, such as the agent sandbox, where static QA runs and the
  test run is handed to the user
- Bad, because every test file shares one validator and the runner executes files in parallel: chain writes have to be
  few, confined to setup, and tolerant of losing a bootstrap race against another file (`already in use` on a singleton
  PDA)
- Bad, because some branches are unreachable against a single-node validator — the poller's `registration_not_found`
  needs two RPC reads served at different slots — and stay uncovered rather than being faked

## More Information

- Exemplar: [`fragments/solana_register_sync/poller.test.ts`](../solana_register_sync/poller.test.ts) — chain writes in
  `before` only, a `Map`-backed fake table behind `aws-sdk-client-mock` that honours exactly the condition expressions
  the poller sends.
- The operational rules live in the `build` skill's _Testing conventions_ section
  ([`.claude/skills/build/SKILL.md`](../../.claude/skills/build/SKILL.md)).
- Feature spec:
  [`specs/001_solana_register_sync_pipeline`](../../specs/001_solana_register_sync_pipeline/requirements.md), task 07
  (the "settled during build" notes).
