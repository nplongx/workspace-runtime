import fs from 'node:fs';
import { readFileWithin, replaceFileWithin } from './secure-filesystem.js';

export const WORKSPACE_WORKFLOW_PORT_VERSION = 1;
export const WORKSPACE_WORKFLOW_PORT_METHODS = Object.freeze([
  'assertSharedConnection', 'getJob', 'getTask', 'getExecutionPlan', 'isApprovalCurrent', 'assertApprovalCurrent',
  'getProposal', 'reviewWrapperKind', 'verifyApprovalBinding', 'compileExecutionPlan',
  'getTaskPlanId', 'recordEvent'
]);

export const WORKSPACE_FILESYSTEM_PORT_VERSION = 1;

export const WORKSPACE_RECEIPT_STORE_PORT_VERSION = 1;
export const WORKSPACE_RECEIPT_STORE_PORT_METHODS = Object.freeze([
  'find', 'insert', 'insertIntent', 'listPendingIntentsForJob', 'getByReceiptId',
  'deleteIntent', 'releaseIntentOwner', 'beginWriteTransaction', 'commitWriteTransaction', 'rollbackWriteTransaction'
]);
export const WORKSPACE_FILESYSTEM_PORT_METHODS = Object.freeze([
  'realpath', 'workspaceWriteScopeForRole', 'pathIsWithinWorkspaceWriteScope',
  'readFileWithin', 'replaceFileWithin'
]);

function bindPort(implementation, methods, label, version) {
  if (!implementation || typeof implementation !== 'object') throw new TypeError(`${label} implementation is required`);
  const port = { version };
  for (const method of methods) {
    if (typeof implementation[method] !== 'function') throw new TypeError(`${label} must provide ${method}()`);
    Object.defineProperty(port, method, {
      enumerable: true, configurable: false, writable: false,
      value: implementation[method].bind(implementation)
    });
  }
  return Object.freeze(port);
}

export function createWorkspaceWorkflowPort(implementation) {
  return bindPort(implementation, WORKSPACE_WORKFLOW_PORT_METHODS,
    'Workspace Workflow port v1', WORKSPACE_WORKFLOW_PORT_VERSION);
}

export function assertWorkspaceWorkflowPort(port) {
  if (!port || port.version !== WORKSPACE_WORKFLOW_PORT_VERSION || !Object.isFrozen(port)) {
    throw new TypeError('Workspace Workflow port v1 must be frozen and versioned');
  }
  for (const method of WORKSPACE_WORKFLOW_PORT_METHODS) {
    if (typeof port[method] !== 'function') throw new TypeError(`Workspace Workflow port v1 must provide ${method}()`);
  }
  return port;
}

export function createWorkspaceFilesystemPort(options = {}) {
  const { workspaceWriteScopeForRole, pathIsWithinWorkspaceWriteScope } = options;
  if (typeof workspaceWriteScopeForRole !== 'function') {
    throw new TypeError('workspaceWriteScopeForRole must be supplied by the Workflow host');
  }
  if (typeof pathIsWithinWorkspaceWriteScope !== 'function') {
    throw new TypeError('pathIsWithinWorkspaceWriteScope must be supplied by the Workflow host');
  }
  return bindPort({
    realpath: typeof options.realpath === 'function' ? options.realpath : root => fs.realpathSync(root),
    workspaceWriteScopeForRole,
    pathIsWithinWorkspaceWriteScope,
    readFileWithin: typeof options.readFileWithin === 'function' ? options.readFileWithin : readFileWithin,
    replaceFileWithin: typeof options.replaceFileWithin === 'function' ? options.replaceFileWithin : replaceFileWithin
  }, WORKSPACE_FILESYSTEM_PORT_METHODS, 'Workspace filesystem port v1', WORKSPACE_FILESYSTEM_PORT_VERSION);
}

export function assertWorkspaceFilesystemPort(port) {
  if (!port || port.version !== WORKSPACE_FILESYSTEM_PORT_VERSION || !Object.isFrozen(port)) {
    throw new TypeError('Workspace filesystem port v1 must be frozen and versioned');
  }
  for (const method of WORKSPACE_FILESYSTEM_PORT_METHODS) {
    if (typeof port[method] !== 'function') throw new TypeError(`Workspace filesystem port v1 must provide ${method}()`);
  }
  return port;
}

export function createWorkspaceReceiptStorePort(implementation) {
  return bindPort(implementation, WORKSPACE_RECEIPT_STORE_PORT_METHODS,
    'Workspace receipt store port v1', WORKSPACE_RECEIPT_STORE_PORT_VERSION);
}

export function assertWorkspaceReceiptStorePort(port) {
  if (!port || port.version !== WORKSPACE_RECEIPT_STORE_PORT_VERSION || !Object.isFrozen(port)) {
    throw new TypeError('Workspace receipt store port v1 must be frozen and versioned');
  }
  for (const method of WORKSPACE_RECEIPT_STORE_PORT_METHODS) {
    if (typeof port[method] !== 'function') throw new TypeError(`Workspace receipt store port v1 must provide ${method}()`);
  }
  return port;
}
