# Source lineage and extraction boundary

## Upstream origin

The package is extracted from the Runalith source repository:

- Repository: https://github.com/nplongx/runalith
- Branch: integration/runalith-system-20261107
- Base revision: 29c24cfa2b6ead5704d26cf2746bc384f2938b80
- Canonical source worktree was dirty when extraction was performed.

Two relevant source files carried pre-existing uncommitted changes in the source tree: src/runtime/workspace-write-capability-service.js and tests/test-workspace-write-capability-service.mjs. The extraction intentionally includes the owner-approval revalidation checks and regression test from that dirty source state. The pinned file manifest records exact copied bytes; the base Git revision alone is not sufficient provenance.

## Included capabilities

- secure-filesystem.js: Linux descriptor-anchored filesystem primitives.
- workspace-write-capability-service.js and workspace-write-receipt-store.js: plan-authorized write orchestration, receipts, intents and recovery.
- case01-artifact-acceptance.js, case01-snapshot-store.js, and case01-snapshot-service.js: snapshot validation, immutable byte storage, reservation and consumption lineage.
- strict-json.js: bounded duplicate-key-safe parser used to validate persisted event/lineage bytes.
- Versioned Workspace and CASE-01 host port contracts and one shared-connection composition root.

The package owns its manifest, public entrypoint, tests, documentation, CI, changelog and repository lifecycle.

## Deliberate exclusions

- workflow/workspace-write-contract.js remains host/Workflow-owned because it depends on Workflow plan compilation and Agent Contracts role capability declarations.
- Workflow proposal/approval/task/result/artifact/attempt/event tables remain Workflow/Execution-owned. Workspace calls them only through versioned semantic ports.
- MCP/HTTP handlers, host configuration, WorkflowStore, Agent Contracts, Trust Governance, process execution and provider adapters are excluded.
- No host databases, workspace content, snapshots, credentials, private keys, deployment files or historical archives are copied.

## Independence and limits

This repository is independently installable and testable from a clean checkout with Node.js built-ins only. It does not import source from the monolith at runtime.

Deployment is still composed inside the Workflow host. Workspace stores intentionally share the Workflow SQLite connection, and CASE-01 has foreign keys to Workflow/Execution-owned rows. Package separation does not imply a separate process, database, transaction coordinator, or independent Workflow authority.

## Pinned source inventory

docs/source-manifest.json records each included source/package file's SHA-256 and byte size. npm run check:manifest verifies exact bytes. It does not synchronize with the upstream repository or verify a current remote branch head.
