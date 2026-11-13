# Host integration and SQLite contract

## Integration rules

Workspace Runtime must be embedded by a trusted Linux host. The host:

- authenticates the requestor and authorizes access to the relevant Workflow;
- resolves the exact approved plan, current owner approval, task and execution state;
- compiles and validates the exact workspace.write path scopes using Workflow and Agent Contracts;
- chooses and protects the workspace root and CASE-01 snapshot directory;
- supplies Workflow ports backed by its authoritative Workflow store;
- opens and owns the SQLite connection and closes it during host shutdown;
- calls Workspace/CASE-01 recovery at the lifecycle points defined by the application.

This package is not an HTTP/MCP listener or a policy/identity authority.

## Public composition

createWorkspaceRuntime() accepts:

| Argument | Owner | Requirement |
|---|---|---|
| database | Host | SQLite-compatible connection with exec() and prepare(). |
| workspaceWorkflowPort | Workflow host adapter | All Workspace Workflow Port v1 methods, including assertSharedConnection. |
| case01WorkflowPort | Workflow host adapter | All CASE-01 Workflow Port v1 methods, including assertSharedConnection. |
| workspaceFilesystemPort | Host policy adapter | Frozen Workspace Filesystem Port v1. Construct with createWorkspaceFilesystemPort() or implement its full allowlist. |
| snapshotBase | Host | Absolute path for private CASE-01 snapshot storage. |
| env, processApi, onRecoveryWarning | Host/tests | Optional runtime environment, process adapter and recovery warning sink. |

The composition invokes assertSharedConnection(database) on both Workflow ports before opening/creating Workspace tables. If either returns anything other than true, composition throws.

## Workspace Workflow Port v1

Required method names:

assertSharedConnection, getJob, getTask, getExecutionPlan, isApprovalCurrent, assertApprovalCurrent, getProposal, reviewWrapperKind, verifyApprovalBinding, compileExecutionPlan, getTaskPlanId, recordEvent.

assertApprovalCurrent(jobId) must verify current signed owner approval and its durable consumption state against trusted host configuration. It cannot be replaced by a boolean flag, event-presence check, actor string, or unverified caller claim.

The implementation should be a small host adapter that binds methods from the authoritative Workflow API and compares the supplied database object with the Workflow connection. Do not expose WorkflowStore.db through the port.

## Workspace Filesystem Port v1

Required methods:

- realpath(root)
- workspaceWriteScopeForRole(contract, role)
- pathIsWithinWorkspaceWriteScope(candidate, scope)
- readFileWithin(root, path)
- replaceFileWithin(root, path, contents, options)

createWorkspaceFilesystemPort() provides realpath, readFileWithin, and replaceFileWithin defaults from this package. The host must supply its Workflow-owned scope resolvers. Scope resolution is not inferred from a role name or from a caller-provided path.

## CASE-01 Workflow Port v1

Required method names:

assertSharedConnection, getExecutionPlan, getProposal, listArtifacts, listArtifactContents, getArtifact, getTask, getResult, hasSuccessfulTaskResult, getAttempt, listEventsForJob, listArtifactCreatedEvents, getEvent, recordEvent, completeLocalTask.

These calls must use the exact Workflow connection passed into Workspace Runtime. The service does not accept raw SQL, dynamically import the host, or open another database.

## SQLite schema requirements

The host opens and configures SQLite. Enable foreign keys on the connection before dependent transactions.

Workspace creates:

- workspace_write_receipts
- workspace_write_intents
- case01_snapshot_reservations
- case01_consumption_acks

Before constructing Workspace Runtime, Workflow/Execution owner tables must already exist:

- jobs(job_id PRIMARY KEY)
- tasks(task_id PRIMARY KEY)
- results(result_id PRIMARY KEY)
- artifacts(artifact_id PRIMARY KEY)
- attempts(attempt_id PRIMARY KEY)

case01_consumption_acks contains foreign keys to those tables. Existing application schemas may have additional columns/constraints. Workspace does not create or migrate these parent tables.

The receipt/intent/snapshot/ack tables are in the same database as Workflow because event writes, Workflow lineage reads, and acknowledgement/receipt commits require one shared SQLite writer transaction. Do not split these records into another DB as part of repository extraction.

## Snapshot directory

snapshotBase must be an absolute path. CASE-01 creates it lazily on the first snapshot operation using mode 0700, and rejects a symlink, non-directory, changed identity, or broad permissions. The host should pre-create and own its parent hierarchy, back up its bytes with the associated database, and keep it unavailable to untrusted local users.

Each snapshot directory is identified by a generated UUID. Snapshot files and manifest data are validated against actual bytes. Do not edit snapshot files in place.

## Recovery operations

- Workspace Write: invoke/reach pending-write recovery before accepting new writes for a Workflow. A live writer identity fences concurrent recovery. Recovery records a receipt when exact after-bytes are present, discards an intent only when exact before-bytes prove the mutation did not occur, and preserves the intent on any third state.
- CASE-01: invoke reconcileSnapshots() during host startup/recovery and at the application's required lifecycle points. It checks durable references/reservations before cleanup.
- CASE-01 acknowledgement validation: call validateConsumptionAck(jobId) before relying on the downstream byte-consumption record.

Do not disable these checks to repair state manually. Inspect byte hashes and Workflow lineage first.

## Backup and restore

SQLite receipt/intent/ack rows and snapshot filesystem bytes form one logical recovery unit. A consistent backup procedure must capture both under a host-controlled write fence and preserve the relationship between stored manifest hashes and actual bytes. Restoring only the database or only the snapshot directory can produce missing references or orphan state. Test restore and recovery against disposable copies before production use.
