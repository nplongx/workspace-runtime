import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_WORKFLOW_PORT_METHODS,
  WORKSPACE_FILESYSTEM_PORT_METHODS,
  WORKSPACE_RECEIPT_STORE_PORT_METHODS,
  createWorkspaceWorkflowPort,
  assertWorkspaceWorkflowPort,
  createWorkspaceFilesystemPort,
  assertWorkspaceFilesystemPort,
  createWorkspaceReceiptStorePort,
  assertWorkspaceReceiptStorePort
} from '../src/runtime/workspace-ports.js';
import {
  CASE01_WORKFLOW_PORT_METHODS,
  CASE01_SNAPSHOT_STORE_PORT_METHODS,
  createCase01WorkflowPort,
  assertCase01WorkflowPort,
  createCase01SnapshotStorePort,
  assertCase01SnapshotStorePort
} from '../src/runtime/workflow/case01-ports.js';

function implementation(methods) {
  return Object.fromEntries(methods.map(method => [method, () => true]));
}

test('Workspace Workflow v1 exposes exact frozen methods and shared-connection assertion', () => {
  const port = createWorkspaceWorkflowPort(implementation(WORKSPACE_WORKFLOW_PORT_METHODS));
  assert.equal(port.version, 1);
  assert.equal(Object.isFrozen(port), true);
  assert.deepEqual(Object.keys(port).filter(key => key !== 'version').sort(), [...WORKSPACE_WORKFLOW_PORT_METHODS].sort());
  assert.equal(assertWorkspaceWorkflowPort(port), port);
  assert.throws(() => createWorkspaceWorkflowPort({}), /assertSharedConnection/);
});

test('Workspace filesystem and receipt store ports are frozen named allowlists', () => {
  const filesystem = createWorkspaceFilesystemPort({
    workspaceWriteScopeForRole() { return null; },
    pathIsWithinWorkspaceWriteScope() { return false; }
  });
  assert.equal(filesystem.version, 1);
  assert.deepEqual(Object.keys(filesystem).filter(key => key !== 'version').sort(), [...WORKSPACE_FILESYSTEM_PORT_METHODS].sort());
  assert.equal(assertWorkspaceFilesystemPort(filesystem), filesystem);

  const receipts = createWorkspaceReceiptStorePort(implementation(WORKSPACE_RECEIPT_STORE_PORT_METHODS));
  assert.equal(receipts.version, 1);
  assert.deepEqual(Object.keys(receipts).filter(key => key !== 'version').sort(), [...WORKSPACE_RECEIPT_STORE_PORT_METHODS].sort());
  assert.equal(assertWorkspaceReceiptStorePort(receipts), receipts);
});

test('CASE-01 Workflow and snapshot store contracts are frozen and versioned', () => {
  const workflow = createCase01WorkflowPort(implementation(CASE01_WORKFLOW_PORT_METHODS));
  const store = createCase01SnapshotStorePort(implementation(CASE01_SNAPSHOT_STORE_PORT_METHODS));
  assert.equal(workflow.version, 1);
  assert.equal(store.version, 1);
  assert.equal(Object.isFrozen(workflow), true);
  assert.equal(Object.isFrozen(store), true);
  assert.equal(assertCase01WorkflowPort(workflow), workflow);
  assert.equal(assertCase01SnapshotStorePort(store), store);
});
