# Security Policy

Report vulnerabilities privately through GitHub Security Advisories for nplongx/workspace-runtime. Do not publish exploit details before maintainers assess impact.

## Security scope

Workspace Runtime performs security-sensitive filesystem operations and stores durable recovery evidence. It is intended to be embedded by a trusted Linux host. It is not a security certification, arbitrary-code sandbox, authenticated network service, or substitute for an independent filesystem/security review.

## Host-owned authority

The host must:
- authenticate callers and bind each request to a trusted Workflow/Task/Role context;
- independently verify current owner approval, immutable plan, task status and execution state;
- compile and validate the exact workspace.write path scopes using Workflow and Agent Contracts;
- supply trusted filesystem roots and protect the directory hierarchy from untrusted local users;
- provide Workflow ports bound to the exact supplied SQLite connection;
- manage DB connection lifetime, foreign keys, backups, restore, retention and monitoring;
- invoke pending-write and snapshot reconciliation on the application's recovery lifecycle.

Never pass unverified role names, caller-supplied approval booleans, unsigned plan hashes, or raw path claims as authorization.

## Approval fence

Workspace Write requires the injected Workflow Port v1 assertApprovalCurrent(jobId) method. It is invoked before the operation and rechecked under writer transaction fences before durable intent/mutation. The host implementation must revalidate the authoritative signed owner approval and its durable consumption state. Missing verifier, revoked trust root, stale plan, invalid signature, or mismatched action/target must deny the write.

The package does not provision owner keys, authenticate signers, maintain trust roots, or decide what action is allowed. Do not replace assertApprovalCurrent() with a cached boolean or an unchecked database row.

## Filesystem boundary

The implementation is Linux-specific and uses /proc/self/fd descriptor-relative operations with O_NOFOLLOW, inode/device checks, bounded files, same-directory temporary files, exclusive creation/rename, fsync and byte readback.

These measures reduce path traversal, symlink substitution, hard-link abuse and compare-before-write races. They do not protect against a compromised process running as the same UID, a malicious administrator, unsafe mount configuration, all filesystem/kernel bugs, or every hostile concurrent local actor. Keep workspace and snapshot roots private and use a dedicated service identity.

No arbitrary shell or command execution is included. Do not treat this library as a full sandbox for untrusted programs.

## SQLite and filesystem recovery

Filesystem bytes cannot commit atomically with SQLite. A committed intent can exist without a receipt, and a mutation may exist after an operation reports failure. The package preserves these states as partial or unresolved; it does not claim false atomicity.

Never delete unresolved intents or rewrite receipts manually to clear errors. Reconcile exact current bytes against the recorded before/after digests. CASE-01 snapshot files and their SQLite reservations/acknowledgements form one logical recovery unit; back up and restore them together.

## Scope limitations

- Workspace paths are relative to a canonical approved root.
- File writes require an exact SHA-256 base digest or ABSENT for exclusive creation.
- Multi-file patches are not atomic.
- patch_id must not be reused for a different request.
- A CASE-01 acknowledgement proves exact submitted bytes and checked Workflow lineage, not unobservable model cognition.
- A content digest is not proof of authorship, authority, or approval.

## Supported platform

Linux only. Other platforms are unsupported rather than silently falling back to weaker filesystem operations.
