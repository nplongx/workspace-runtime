import path from 'node:path';
import {
  createWorkspaceWriteCapabilityService
} from './workspace-write-capability-service.js';
import { createWorkspaceWriteReceiptStore } from './workspace-write-receipt-store.js';
import { createWorkspaceWorkflowPort, assertWorkspaceWorkflowPort, createWorkspaceFilesystemPort, assertWorkspaceFilesystemPort, createWorkspaceReceiptStorePort } from './workspace-ports.js';
import {
  createCase01SnapshotStore
} from './workflow/case01-snapshot-store.js';
import { createCase01WorkflowPort, assertCase01WorkflowPort, createCase01SnapshotStorePort } from './workflow/case01-ports.js';
import {
  createCase01SnapshotService
} from './workflow/case01-snapshot-service.js';

export const WORKSPACE_RUNTIME_COMPOSITION_VERSION = 1;


/**
 * Compose Workspace Write and CASE-01 on one host-owned SQLite connection.
 * Workflow authority and filesystem scope policy remain injected by the host.
 */
export function createWorkspaceRuntime({
  database,
  workspaceWorkflowPort,
  case01WorkflowPort,
  workspaceFilesystemPort,
  snapshotBase,
  env = process.env,
  processApi = process,
  onRecoveryWarning
} = {}) {
  if (!database || typeof database.exec !== 'function' || typeof database.prepare !== 'function') {
    throw new TypeError('createWorkspaceRuntime requires a SQLite-compatible database connection');
  }
  if (typeof snapshotBase !== 'string' || !path.isAbsolute(snapshotBase)) {
    throw new TypeError('createWorkspaceRuntime requires an absolute CASE-01 snapshotBase');
  }
  const workspacePort = workspaceWorkflowPort?.version === 1 && Object.isFrozen(workspaceWorkflowPort)
    ? assertWorkspaceWorkflowPort(workspaceWorkflowPort) : createWorkspaceWorkflowPort(workspaceWorkflowPort);
  const case01Port = case01WorkflowPort?.version === 1 && Object.isFrozen(case01WorkflowPort)
    ? assertCase01WorkflowPort(case01WorkflowPort) : createCase01WorkflowPort(case01WorkflowPort);
  const filesystemPort = workspaceFilesystemPort?.version === 1 && Object.isFrozen(workspaceFilesystemPort)
    ? assertWorkspaceFilesystemPort(workspaceFilesystemPort) : createWorkspaceFilesystemPort(workspaceFilesystemPort);
  for (const [label, port] of [['Workspace', workspacePort], ['CASE-01', case01Port]]) {
    if (port.assertSharedConnection(database) !== true) {
      throw new TypeError(`${label} Workflow port must confirm the exact injected SQLite connection`);
    }
  }
  const workspaceWriteReceiptStore = createWorkspaceWriteReceiptStore(database);
  const workspaceReceiptPort = createWorkspaceReceiptStorePort(workspaceWriteReceiptStore);
  const case01SnapshotStore = createCase01SnapshotStore(database);
  const case01StorePort = createCase01SnapshotStorePort(case01SnapshotStore);
  const workspaceWriteService = createWorkspaceWriteCapabilityService({
    workflowPort: workspacePort,
    workspacePort: filesystemPort,
    receiptStore: workspaceReceiptPort
  });
  const case01SnapshotService = createCase01SnapshotService({
    workflowPort: case01Port,
    snapshotStore: case01StorePort,
    snapshotBase,
    env,
    processApi,
    ...(onRecoveryWarning ? { onRecoveryWarning } : {})
  });
  return Object.freeze({
    version: WORKSPACE_RUNTIME_COMPOSITION_VERSION,
    workspaceWriteService,
    case01SnapshotService,
    workspaceWriteReceiptStore,
    case01SnapshotStore
  });
}
