# Specs

Feature specs for the custom spec-driven workflow. Each feature lives in its own numbered directory:

```
specs/
  NNN_feature_slug/
    requirements.md        # the product ask (spec-ideate)
    tasks/
      README.md            # ordered task checklist (spec-tasks)
      NN_task_slug.md       # one deliverable task per file
```

The workflow is driven by three skills (`.claude/skills/`): [`spec-ideate`](../.claude/skills/spec-ideate/) →
[`spec-tasks`](../.claude/skills/spec-tasks/) → [`spec-build`](../.claude/skills/spec-build/). Feature numbers are
zero-padded and never reused (same convention as the ADRs).

## Index

| Feature                                                                                                      | Created    | Status  |
| ------------------------------------------------------------------------------------------------------------ | ---------- | ------- |
| [001: Solana register event sync pipeline (Kubernetes)](./001_solana_register_sync_pipeline/requirements.md) | 2026-07-09 | Planned |
