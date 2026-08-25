# Tasks — 001 Solana register event sync pipeline

Ordered by dependency. Each task is independently committable, QA-able and verifiable. `spec-build` delivers them one at
a time and ticks them off here.

## On-chain foundation

- [x] 01 — [Feature-flagged `declare_id!` for a prod register instance](./01_register_prod_feature_flag.md)
- [x] 02 — [Bootstrap the prod register instance on devnet](./02_prod_instance_devnet_bootstrap.md)
- [x] 03 — [`solana_deploy.yml` dev/prod matrix](./03_solana_deploy_dev_prod_matrix.md)

## AWS substrate

- [x] 04 — [DynamoDB registrations table and 14-day queue retention](./04_terraform_dynamodb_and_queue_retention.md)
- [ ] 05 — [EventBridge custom bus and rules to the existing queues](./05_terraform_eventbridge_bus_and_rules.md)
- [ ] 06 — [Secrets Manager secrets and scoped IAM identities](./06_terraform_secrets_and_iam_identities.md)

## Ingestion (chain → queue)

- [ ] 07 — [Lambda poller (Node.js)](./07_lambda_poller_node.md)
- [ ] 08 — [Lambda + EventBridge Scheduler (chain to queue, end to end)](./08_terraform_lambda_and_scheduler.md)

## Consumers

- [ ] 09 — [Registrants consumer (Node.js)](./09_registrants_consumer_node.md)
- [ ] 10 — [Confirmed consumer / auditor (Node.js)](./10_confirmed_consumer_node.md)
- [ ] 11 — [Registrants consumer (Python)](./11_registrants_consumer_python.md)
- [ ] 12 — [Confirmed consumer / auditor (Python)](./12_confirmed_consumer_python.md)

## Kubernetes

- [ ] 13 — [Publish the consumer images to Docker Hub](./13_docker_hub_consumer_images.md)
- [ ] 14 — [Local KIND cluster and Kustomize base](./14_kind_local_cluster.md)
- [ ] 15 — [k3s on EC2 in `ff_dev`](./15_terraform_k3s_ec2_dev.md)
- [ ] 16 — [`dev-cloud` toggle script](./16_dev_cloud_toggle.md)
- [ ] 17 — [`ff_prod` rollout and overnight pause](./17_terraform_prod_rollout_and_overnight_pause.md)

## Decisions settled during planning

- **k8s manifests:** Kustomize overlays under `fragments/k8s/` (mirroring `fragments/terraform/`) — `base/` +
  `overlays/{kind,ff_dev,ff_prod}`, with cluster helper scripts under `fragments/k8s/scripts/`. Environment config is
  carried by a per-overlay `configMapGenerator` consumed via `envFrom`, avoiding strategic-merge patches for single
  variables. Helm remains excluded.
- **Container images:** Docker Hub, extending the existing `docker.yml` publishing pattern. ECR was rejected: the images
  are public OSS artifacts with no confidentiality requirement, so ECR's IAM-gated pull offers learning value rather
  than product value.
- **Architecture:** `arm64` end to end in the cloud — a Graviton `t4g.small` for k3s (task 15) and an `arm64` Lambda
  (task 08). `ff_node` and `ff_python` are published as multi-arch manifest lists (`amd64` + `arm64`, task 13), which
  also removes emulation from the local Apple Silicon Docker loop. The older `ff_solana` / `ff_anchor` /
  `ff_solana_builder` images stay `amd64`-only; that constraint predates this feature and was not revisited.
- **ADRs:** written alongside the task that makes each decision, not batched retrospectively. Seven in total — the five
  named in the requirements, plus one for Docker Hub over ECR (task 13) and one for k3s over EKS (task 15).

## ADR map

| ADR (create with `/new-adr`)                                               | Task |
| -------------------------------------------------------------------------- | ---- |
| Two on-chain instances via feature-flagged `declare_id!`, shared authority | 01   |
| DynamoDB as the central datastore                                          | 04   |
| EventBridge-centred event architecture                                     | 05   |
| Docker Hub over ECR for image distribution                                 | 13   |
| Local KIND cluster against real cloud resources                            | 14   |
| k3s on EC2 over EKS                                                        | 15   |
| Scheduled overnight pause (`Europe/London`) as cost control                | 17   |
