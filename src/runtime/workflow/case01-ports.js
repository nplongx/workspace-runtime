export const CASE01_WORKFLOW_PORT_VERSION = 1;
export const CASE01_WORKFLOW_PORT_METHODS = Object.freeze([
  'assertSharedConnection', 'getExecutionPlan', 'getProposal', 'listArtifacts', 'listArtifactContents', 'getArtifact',
  'getTask', 'getResult', 'hasSuccessfulTaskResult', 'getAttempt', 'listEventsForJob',
  'listArtifactCreatedEvents', 'getEvent', 'recordEvent', 'completeLocalTask'
]);

export const CASE01_SNAPSHOT_STORE_PORT_VERSION = 1;
export const CASE01_SNAPSHOT_STORE_PORT_METHODS = Object.freeze([
  'reserveSnapshot', 'deleteSnapshotReservation', 'listSnapshotReservations', 'listReservedSnapshotIds',
  'beginSnapshotCleanupTransaction', 'commitSnapshotCleanupTransaction', 'rollbackSnapshotCleanupTransaction',
  'beginConsumptionAckTransaction', 'commitConsumptionAckTransaction', 'rollbackConsumptionAckTransaction',
  'getConsumptionAck', 'insertConsumptionAck'
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

export function createCase01WorkflowPort(implementation) {
  return bindPort(implementation, CASE01_WORKFLOW_PORT_METHODS,
    'CASE-01 Workflow port v1', CASE01_WORKFLOW_PORT_VERSION);
}

export function createCase01SnapshotStorePort(implementation) {
  return bindPort(implementation, CASE01_SNAPSHOT_STORE_PORT_METHODS,
    'CASE-01 snapshot store port v1', CASE01_SNAPSHOT_STORE_PORT_VERSION);
}

export function assertCase01WorkflowPort(port) {
  if (!port || port.version !== CASE01_WORKFLOW_PORT_VERSION || !Object.isFrozen(port)) {
    throw new TypeError('CASE-01 Workflow port v1 must be frozen and versioned');
  }
  for (const method of CASE01_WORKFLOW_PORT_METHODS) {
    if (typeof port[method] !== 'function') throw new TypeError(`CASE-01 Workflow port v1 must provide ${method}()`);
  }
  return port;
}

export function assertCase01SnapshotStorePort(port) {
  if (!port || port.version !== CASE01_SNAPSHOT_STORE_PORT_VERSION || !Object.isFrozen(port)) {
    throw new TypeError('CASE-01 snapshot store port v1 must be frozen and versioned');
  }
  for (const method of CASE01_SNAPSHOT_STORE_PORT_METHODS) {
    if (typeof port[method] !== 'function') throw new TypeError(`CASE-01 snapshot store port v1 must provide ${method}()`);
  }
  return port;
}
