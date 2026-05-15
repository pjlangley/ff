# Terraform directory and workspace layout

**Status:** Accepted | **Date:** 2026-04-28

## Context and Problem Statement

This project's AWS infrastructure is deployed to two environments (`dev` and `prod`), both Terraform-managed. The two
environments share the same resource shapes but differ in (1) some variable values (e.g. `environment`, AWS provider
`profile`) and (2) execution mode — [`ff_dev`](../terraform/ff_dev/) runs `terraform` locally on the laptop,
[`ff_prod`](../terraform/ff_prod/) runs remotely on an HCP runner. Should this live in one workspace root parameterised
by environment, or one workspace root per environment that share modules?

## Considered Options

- One workspace root, environment selected by `*.tfvars` / HCP workspace
- One workspace root per environment, sharing modules from [`fragments/terraform/modules/`](../terraform/modules/)

## Decision Outcome

Chosen option: "one workspace root per environment, sharing modules", because execution mode is a property of the HCP
workspace, not a variable — and the `cloud {}` block in `main.tf` binds the root to a single HCP workspace name. A
single shared root couldn't cleanly serve both a local-execution dev workflow and a remote-execution prod workflow; the
AWS provider's `profile` setting would need conditional handling, and every `terraform` invocation would have to
negotiate which HCP workspace it's targeting. Per-environment roots make the asymmetry explicit. Duplication is
mitigated by extracting shared resources into modules under [`fragments/terraform/modules/`](../terraform/modules/), and
by `local.name_prefix = "${var.project}_${var.environment}"` keeping resource naming deterministic per env.

### Consequences

- Good, because each environment's execution mode is explicit and self-contained — no conditional logic in code
- Good, because the AWS provider can hardcode `profile = "ff_dev"` for local dev without leaking into prod
- Good, because shared modules give DRY for resource shapes; roots stay thin
- Good, because `local.name_prefix` keeps resource names deterministic per env without cross-env contamination
- Bad, because near-identical files (e.g. `variables.tf`, `main.tf`, etc.) must be kept in sync by hand
- Bad, because adding a new resource often means editing two roots (or extracting to a module first)
- Bad, because adding a new environment means copying a root, not just adding a tfvars file

## More Information

- The two roots: [`fragments/terraform/ff_dev/`](../terraform/ff_dev/) and
  [`fragments/terraform/ff_prod/`](../terraform/ff_prod/)
- Shared modules: [`fragments/terraform/modules/`](../terraform/modules/)
- Related: [ADR 001](./001_hcp_terraform_state_backend.md) for the state backend decision
- Setup details: the [Terraform section of the README](../../README.md#terraform)
