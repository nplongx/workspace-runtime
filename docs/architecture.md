# Architecture and ownership

## Purpose

@runalith/workspace-runtime contains two host-composed capabilities:

1. Workspace Write: plan-scoped filesystem replacement with durable intent/receipt and recovery.
2. CASE-01: immutable workspace snapshots, orphan/restart recovery, and exact downstream consumption acknowledgement.

The package owns filesystem mutation helpers and its receipt/snapshot tables. Workflow owns plans, approval decisions, task/result/artifact/event history, agent roles, and the policy that grants a role access to a path. All domains remain in one process and one SQLite transaction unit.

## Component view

~~~mermaid
flowchart TD
  Host[Runalith composition host] --> Workflow[Workflow-owned query/command APIs]
  Host --> DB[Host-owned DatabaseSync connection]
  Host --> FS[Filesystem policy + approved workspace root]
  DB --> Compose[createWorkspaceRuntime]
  Workflow --> WPort[Workspace Workflow Port v1]
  Workflow --> CPort[CASE-01 Workflow Port v1]
  FS --> FPort[Workspace Filesystem Port v1]
  Compose --> Write[WorkspaceWriteCapabilityService]
  Compose --> Snapshot[Case01SnapshotService]
  Compose --> Receipt[WorkspaceReceiptStore]
  Compose --> SnapStore[Case01SnapshotStore]
  Write --> FPort
  Write --> WPort
  Write --> Receipt
  Snapshot --> CPort
  Snapshot --> SnapStore
  Receipt --> DB
  SnapStore --> DB
  Write --> Bytes[Descriptor-anchored filesystem operations]
  Snapshot --> SnapBytes[Immutable snapshot bytes + digest manifest]
~~~

The port interfaces are boundaries inside one process and one database. They are not RPC APIs or evidence that Workflow and Workspace can be deployed independently.

## Module map

| Module | Responsibility | Boundary |
|---|---|---|
| index.js | Supported root exports. | New consumers use this entrypoint. |
| src/runtime/workspace-runtime.js | Compose Workspace Write and CASE-01 against one supplied SQLite connection. | Verifies both Workflow ports accept the exact connection first. |
| src/runtime/workspace-ports.js | Versioned Workspace Workflow, Filesystem, and receipt-store port contracts. | Frozen allowlists; no raw SQL or DB handles passed to services. |
| src/runtime/workspace-write-capability-service.js | Authorization preflight, write-intent lifecycle, per-file mutation, receipt/event commit, restart recovery, partial outcome reporting. | Workflow approval and path-scope policy are injected. |
| src/runtime/workspace-write-receipt-store.js | Schema, receipt/intent validation, readback, and named writer transaction operations. | Owns two Workspace Write tables on the host connection. |
| src/runtime/secure-filesystem.js | Descriptor-anchored path resolution, read/lstat, exclusive creation, atomic replacement and exact readback. | Linux /proc/self/fd; no arbitrary shell/process execution. |
| src/runtime/workflow/workspace-write-contract.js (host-owned) | Normalizes plan scopes and checks role capability. | Deliberately not included: depends on Workflow plan and Agent Contracts policy. Host sends validated scope-policy functions through the Filesystem Port. |
| src/runtime/workflow/case01-ports.js | Versioned CASE-01 Workflow and snapshot-store contracts. | Frozen named methods. |
| src/runtime/workflow/case01-artifact-acceptance.js | Snapshot creation/removal, byte validation, exact manifest checking, and orphan enumeration. | No database and no Workflow implementation imports. |
| src/runtime/workflow/case01-snapshot-store.js | Snapshot reservation and consumption-ack schema and writes. | Foreign keys reference parent Workflow/Execution tables; same SQLite connection required. |
| src/runtime/workflow/case01-snapshot-service.js | Snapshot lifecycle/compensation, durable lineage validation, byte-consumption acknowledgement and reconciliation. | All Workflow reads/writes arrive through CASE-01 Workflow Port v1. |
| src/runtime/strict-json.js | Bounded strict JSON parser used for durable event and lineage validation. | Local parser source; no dependency on the host tree. |

## Transaction boundaries

### Workspace Write

For each file, the service commits a pending intent, performs the filesystem operation, then opens a SQLite writer transaction to recheck Workflow state, write the receipt, append the Workflow event, and delete the intent. The filesystem operation cannot participate in SQLite atomic commit. A crash between these steps is resolved from exact before/after bytes and the durable intent.

Each file is its own operation. A multi-file request is not a transaction: earlier file receipts remain durable if a later file fails. The result reports partial or unresolved effects.

### CASE-01

The snapshot store provides explicit writer transaction controls for reservation cleanup and acknowledgement. The service reads Workflow artifact/result/attempt/event state through the host port while the shared SQLite writer transaction serializes those checks with acknowledgement persistence.

The snapshot bytes live outside SQLite. Reservation and compensating cleanup protect the filesystem/DB split; the service deletes a snapshot only after checking no durable Workflow artifact references it under the writer reservation.

## Connection and authority invariants

- createWorkspaceRuntime() accepts one host-owned SQLite connection.
- Both Workflow ports must implement assertSharedConnection(database) and return true only for the exact connection used by Workflow.
- The check happens before Workspace schema creation. Independent SQLite handles to the same path do not pass.
- Workspace stores do not expose their connection to services.
- Workflow owns plan, approval, task, artifact, result, attempt and event authority.
- The host owns role definitions and scope compilation. Workspace only evaluates scopes supplied through its versioned Filesystem Port.
- assertApprovalCurrent() must revalidate trusted owner approval. The service calls it before mutation and again inside writer fences.
- Filesystem writes and SQLite changes can have partial/unknown outcomes. The host must surface those outcomes and must not invent success.

## Dependency model

Runtime source depends only on Node.js built-ins. No Workflow monolith module, Agent Contracts module, parent workspace package, Git submodule, or sibling repository is imported at runtime.

The host integrates through versioned ports and the shared SQLite connection. This is package-source independence, not deployment or datastore independence.
