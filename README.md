# Workspace Runtime

[![CI](https://github.com/nplongx/workspace-runtime/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nplongx/workspace-runtime/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**@runalith/workspace-runtime** is a Linux Node.js library for plan-authorized workspace file replacement, durable write receipts and recovery, and CASE-01 workspace snapshots with exact downstream byte-consumption acknowledgement.

This is a host-composed library, not a daemon, MCP server, authorization service, or standalone filesystem sandbox. The host remains the authority for Workflow plans, approvals, task ownership, roles, caller identity, filesystem scope policy, and event history.

> **Status:** 0.1.0, GitHub-first source package. Not published to npm. Public APIs and storage compatibility remain pre-1.0.

## Scope

- Descriptor-anchored Linux filesystem reads, writes, atomic file replacement, and path/type checks.
- Plan-scoped workspace.write operation through an injected Workflow API and injected role-scope policy.
- Compare-before-write using an exact SHA-256 base digest or ABSENT for exclusive creation.
- Per-file durable write intent, receipt, event append, idempotent retry, and restart recovery.
- Explicit unresolved/partial outcomes when filesystem bytes and SQLite receipts cannot commit atomically.
- CASE-01 immutable workspace snapshots, reservation/compensation, orphan recovery, and durable downstream consumption acknowledgement.
- Exact byte/hash and Workflow artifact/result/attempt/event lineage checks for CASE-01 consumption.

## Non-goals

The package does not create or approve Workflow plans, establish user/agent identity, verify owner signatures or signed approval policy, issue capabilities, run arbitrary commands, schedule tasks, call providers, expose a network endpoint, or create a separate database/service. It does not provide an atomic multi-file transaction. Workflow and trust authorities remain host-owned.

## Platform and requirements

- Linux only. The secure filesystem implementation relies on /proc/self/fd, descriptor-relative operations, and Linux /proc process identity.
- Node.js >=22.13.0, including built-in node:sqlite when using the composed stores.
- A host-owned SQLite connection shared with Workflow for receipt/event and CASE-01 lineage transactions.
- A workspace root and snapshot base selected and permissioned by the host.

No third-party runtime dependency.

## Install

~~~sh
npm install github:nplongx/workspace-runtime
~~~

## Composition

createWorkspaceRuntime() creates Workspace Write and CASE-01 stores/services using one injected SQLite connection:

~~~js
import {
  createWorkspaceRuntime,
  createWorkspaceFilesystemPort,
} from '@runalith/workspace-runtime';

// These bindings come from the host's existing Workflow composition.
const { database, workflowStore, workflowPolicy } = host.workflowBindings;
const workspaceWorkflowPort = host.createWorkspaceWorkflowPort(workflowStore);
const case01WorkflowPort = host.createCase01WorkflowPort(workflowStore);

const filesystemPort = createWorkspaceFilesystemPort({
  // These two policy functions remain Workflow/host-owned.
  workspaceWriteScopeForRole: (contract, role) => workflowPolicy.workspaceWriteScopeForRole(contract, role),
  pathIsWithinWorkspaceWriteScope: (candidate, scope) => workflowPolicy.pathIsWithinWorkspaceWriteScope(candidate, scope),
});

const workspace = createWorkspaceRuntime({
  database,
  workspaceWorkflowPort,
  case01WorkflowPort,
  workspaceFilesystemPort: filesystemPort,
  snapshotBase: '/var/lib/runalith/case01-snapshots',
});

// Host closes database after stopping all Workspace/Workflow users.
// workspace.workspaceWriteService.applyWrite(...)
// workspace.case01SnapshotService.completeRequirementsTask(...)
~~~

The example is a host integration sketch: workflowStore, workflowPolicy, and the omitted methods are supplied by the host, not by this package.

The composition calls assertSharedConnection(database) on both Workflow ports **before creating Workspace tables**. Both callbacks must return true only when the exact SQLite connection is the one used by Workflow. A mismatch fails closed. Separate DatabaseSync handles to the same file do not satisfy this identity contract.

## Versioned integration ports

### Workspace Workflow Port v1

The host supplies these methods:

- assertSharedConnection(database)
- getJob, getTask, getExecutionPlan
- isApprovalCurrent, assertApprovalCurrent
- getProposal, reviewWrapperKind, verifyApprovalBinding
- compileExecutionPlan, getTaskPlanId, recordEvent

assertApprovalCurrent() must revalidate current signed owner approval and its durable consumption state against trusted host configuration. Missing, revoked, expired, or mismatched approval must fail closed through this host method.

### Workspace Filesystem Port v1

Supplies realpath, workspaceWriteScopeForRole, pathIsWithinWorkspaceWriteScope, readFileWithin, and replaceFileWithin. The package provides secure default filesystem functions. Role-scope resolution remains host policy because plan compilation and agent-role contracts are owned elsewhere.

### CASE-01 Workflow Port v1

The host supplies exact Workflow queries/commands for plans, proposals, tasks, results, artifacts, attempts, events, completion, and event append, plus assertSharedConnection(database). CASE-01 verifies durable Workflow lineage through these methods; it does not import or query WorkflowStore internals.

### Store ports

WorkspaceReceiptStorePort v1 and Case01SnapshotStorePort v1 are frozen named-method surfaces. Transaction methods are explicit and limited to the relevant domain operations; no raw database handle or generic SQL callback is exposed through the service contracts.

## Workspace Write semantics

1. Host Workflow compiles and approves a plan that declares the workspace.write operation and role-specific path scopes.
2. Host resolves the approved role scope and supplies Workflow/filesystem ports.
3. applyWrite() validates the active executing task, current plan and approval, canonical workspace root, task role, path scope, request size, patch identity, and compare-before-write digest.
4. A durable write intent is committed before filesystem mutation.
5. The package performs descriptor-anchored atomic replacement for one file, reads back bytes, and checks exact size/hash.
6. Receipt insertion, Workflow event append, and intent removal are committed through the same SQLite connection.
7. A retry with the exact same patch_id and request can reconcile an already-applied write. Conflicting reuse is rejected.

**Per-file, not multi-file atomicity.** A multi-file patch can commit earlier file receipts and then fail on a later file. The result reports partial effects. A filesystem mutation followed by receipt failure is not reported as “not modified”; it remains unresolved until bytes and durable intent are reconciled.

Do not blindly retry a failed or ambiguous patch with a new ID. Inspect exact file bytes and receipts; retry only the identical request with the same patch_id when the recorded base/after hashes support safe reconciliation.

## CASE-01 semantics

CASE-01 stores immutable workspace snapshots under a host-provided private snapshot base. Its service:

- creates snapshots from the approved workspace manifest;
- validates required workspace files, path identity, size, exact file set, and SHA-256 digests;
- records a durable reservation before snapshot creation;
- compensates only when no durable Workflow artifact references the snapshot;
- reconciles stale reservations and orphan snapshots;
- verifies the exact bytes submitted by the downstream consumer;
- binds source/CTO artifacts, successful results, attempts, completion events, artifact events, consumed bytes, and acknowledgement into a durable lineage record.

The required CASE-01 workspace files are config.json and result.json. An acknowledgement proves the submitted bytes match the immutable snapshot and durable Workflow lineage. It does **not** prove unobservable model cognition or that a consumer semantically understood the bytes.

## Database ownership

Workspace stores own these tables:

- workspace_write_receipts
- workspace_write_intents
- case01_snapshot_reservations
- case01_consumption_acks

case01_consumption_acks has foreign keys to Workflow/Execution-owned jobs, tasks, results, artifacts, and attempts. The Workflow host must initialize those owner tables first. Workspace does not create, migrate, or own them.

These tables and all related Workflow events intentionally share the exact Workflow SQLite connection so receipt/event, snapshot/lineage, and acknowledgement operations retain existing same-connection transaction semantics. This is repository/package separation, **not** an independent datastore or process.

The host owns connection opening/closing, WAL and foreign-key policy, database path permissions, backup/restore, schema migration order, and deployment.

## Validation

~~~sh
npm ci
npm run check
npm run test:packed-consumer
npm run pack:check
~~~

Tests cover secure workspace file handling, immutable snapshot verification, durable receipt/intent writes, retry conflicts, partial failure, crash/restart recovery, owner-approval revalidation fences, store schema, explicit port contracts, exact shared-connection composition, and clean packed-consumer installation.

CI runs Node.js 22 and 24 on Ubuntu. Unit and local integration tests do not certify a host's Workflow authorization wiring, filesystem mount policy, operator procedures, or production deployment.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture and ownership](docs/architecture.md)
- [Host integration and SQLite contract](docs/integration.md)
- [Terminology](docs/terminology.md)
- [Source lineage and exclusions](docs/source-lineage.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Pinned source manifest](docs/source-manifest.json)

## License

MIT. See LICENSE.
