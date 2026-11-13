# Terminology

| Term | Meaning |
|---|---|
| Workspace | Canonical filesystem root authorized for one Workflow execution. |
| Scope | Role-bound relative path set compiled from the approved Workflow plan. |
| Patch | One request to write one or more scoped files. |
| patch_id | Stable idempotency identity for a logical Workspace Write request. Exact retries reuse the same ID and request bytes. |
| Write intent | Durable record committed before filesystem mutation. It records expected before/after digests and writer identity. |
| Receipt | Durable confirmation that exact bytes were read back and Workflow event lineage committed. |
| Partial outcome | Some per-file writes committed while a later file failed. Not an all-or-nothing patch. |
| Unresolved outcome | Filesystem mutation may have occurred but durable receipt state is incomplete or conflicts with observed bytes. |
| Snapshot | Immutable copy of the declared CASE-01 workspace files identified by a generated UUID and content manifest. |
| Consumption acknowledgement | Durable lineage record that the exact verified snapshot bytes were submitted by a downstream consumer. |
| Host | Application that authenticates callers, owns Workflow authority, opens SQLite, and composes Workspace Runtime. |

## Digest and authority semantics

A SHA-256 digest establishes byte identity relative to a chosen input. It does not prove who created the bytes, whether the caller is authorized to write them, or whether a model understood a snapshot.

Workspace Write authorization comes from the host's current Workflow state, signed owner approval verification, immutable plan, task identity, role and path scope. Filesystem checks alone do not authorize a write.

## Compatibility

Persisted table/column names, event types, error codes, port versions, and filesystem receipt meanings are compatibility surfaces. Change them with an explicit schema/API migration. Do not rename them for style alone.
