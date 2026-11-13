/** Public API for the standalone Workspace Runtime package. */
export {
  WORKSPACE_RUNTIME_COMPOSITION_VERSION,
  createWorkspaceRuntime
} from './src/runtime/workspace-runtime.js';

export {
  WORKSPACE_WORKFLOW_PORT_VERSION,
  WORKSPACE_WORKFLOW_PORT_METHODS,
  WORKSPACE_FILESYSTEM_PORT_VERSION,
  WORKSPACE_FILESYSTEM_PORT_METHODS,
  WORKSPACE_RECEIPT_STORE_PORT_VERSION,
  WORKSPACE_RECEIPT_STORE_PORT_METHODS,
  createWorkspaceWorkflowPort,
  createWorkspaceReceiptStorePort,
  assertWorkspaceReceiptStorePort,
  assertWorkspaceWorkflowPort,
  createWorkspaceFilesystemPort,
  assertWorkspaceFilesystemPort
} from './src/runtime/workspace-ports.js';

export {
  WorkspaceWriteCapabilityError,
  WorkspaceWriteCapabilityService,
  createWorkspaceWriteCapabilityService
} from './src/runtime/workspace-write-capability-service.js';
export {
  WorkspaceWriteReceiptStore,
  createWorkspaceWriteReceiptStore
} from './src/runtime/workspace-write-receipt-store.js';

export {
  CASE01_WORKFLOW_PORT_VERSION,
  CASE01_WORKFLOW_PORT_METHODS,
  CASE01_SNAPSHOT_STORE_PORT_VERSION,
  CASE01_SNAPSHOT_STORE_PORT_METHODS,
  createCase01WorkflowPort,
  assertCase01WorkflowPort,
  createCase01SnapshotStorePort,
  assertCase01SnapshotStorePort
} from './src/runtime/workflow/case01-ports.js';
export {
  CASE01_REQUIRED_WORKSPACE_FILES,
  collectCase01SnapshotReferences,
  validateCase01DurableSnapshotReferences,
  createCase01WorkspaceSnapshot,
  removeCase01WorkspaceSnapshot,
  reconcileCase01WorkspaceSnapshots,
  validateCase01WorkspaceArtifact,
  readVerifiedCase01WorkspaceSnapshot
} from './src/runtime/workflow/case01-artifact-acceptance.js';
export {
  Case01SnapshotStore,
  createCase01SnapshotStore
} from './src/runtime/workflow/case01-snapshot-store.js';
export {
  Case01SnapshotService,
  createCase01SnapshotService
} from './src/runtime/workflow/case01-snapshot-service.js';

export {
  resolveWithinRoot,
  openDirectoryWithin,
  writeFileAtDirectory,
  readFileAtDirectory,
  lstatAtDirectory,
  readlinkAtDirectory,
  readFileWithin,
  lstatWithin,
  readlinkWithin,
  writeFileWithin,
  replaceFileWithin
} from './src/runtime/secure-filesystem.js';
export { MAX_STRICT_JSON_BYTES, parseStrictJson } from './src/runtime/strict-json.js';
