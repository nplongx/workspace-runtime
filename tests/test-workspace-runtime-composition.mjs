import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  createWorkspaceRuntime,
  WORKSPACE_RUNTIME_COMPOSITION_VERSION,
  WORKSPACE_WORKFLOW_PORT_METHODS,
  CASE01_WORKFLOW_PORT_METHODS,
  createWorkspaceFilesystemPort
} from '../index.js';

function portFrom(methods, overrides = {}) {
  return Object.fromEntries(methods.map(method => [method, overrides[method] || (() => null)]));
}

function baseDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE jobs(job_id TEXT PRIMARY KEY);
    CREATE TABLE tasks(task_id TEXT PRIMARY KEY);
    CREATE TABLE results(result_id TEXT PRIMARY KEY);
    CREATE TABLE artifacts(artifact_id TEXT PRIMARY KEY);
    CREATE TABLE attempts(attempt_id TEXT PRIMARY KEY);`);
  return database;
}

test('Workspace Runtime composes both domains against one exact host SQLite connection', () => {
  const database = baseDatabase();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-runtime-compose-'));
  const snapshotBase = path.join(temporaryRoot, 'case01-snapshots');
  const workspaceWorkflowPort = portFrom(WORKSPACE_WORKFLOW_PORT_METHODS, {
    assertSharedConnection(connection) { return connection === database; }
  });
  const case01WorkflowPort = portFrom(CASE01_WORKFLOW_PORT_METHODS, {
    assertSharedConnection(connection) { return connection === database; }
  });
  const workspaceFilesystemPort = createWorkspaceFilesystemPort({
    workspaceWriteScopeForRole() { return null; },
    pathIsWithinWorkspaceWriteScope() { return false; }
  });

  try {
    const runtime = createWorkspaceRuntime({
      database,
      workspaceWorkflowPort,
      case01WorkflowPort,
      workspaceFilesystemPort,
      snapshotBase,
      env: { NODE_ENV: 'test' }
    });
    assert.equal(runtime.version, WORKSPACE_RUNTIME_COMPOSITION_VERSION);
    assert.equal(Object.isFrozen(runtime), true);
    assert.equal(typeof runtime.workspaceWriteService.applyWrite, 'function');
    assert.equal(typeof runtime.case01SnapshotService.recordConsumptionAck, 'function');
    assert.equal(fs.existsSync(snapshotBase), false, 'construction must not create snapshot storage');
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    for (const table of ['workspace_write_receipts', 'workspace_write_intents',
      'case01_snapshot_reservations', 'case01_consumption_acks']) {
      assert.ok(tables.has(table), `missing subsystem-owned table ${table}`);
    }
    assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  } finally {
    database.close();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('Workspace Runtime rejects a Workflow port bound to a different connection before creating subsystem schema', () => {
  const database = baseDatabase();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-runtime-mismatch-'));
  const workspaceWorkflowPort = portFrom(WORKSPACE_WORKFLOW_PORT_METHODS, {
    assertSharedConnection() { return false; }
  });
  const case01WorkflowPort = portFrom(CASE01_WORKFLOW_PORT_METHODS, {
    assertSharedConnection(connection) { return connection === database; }
  });
  const workspaceFilesystemPort = createWorkspaceFilesystemPort({
    workspaceWriteScopeForRole() { return null; },
    pathIsWithinWorkspaceWriteScope() { return false; }
  });
  try {
    assert.throws(() => createWorkspaceRuntime({
      database,
      workspaceWorkflowPort,
      case01WorkflowPort,
      workspaceFilesystemPort,
      snapshotBase: path.join(temporaryRoot, 'snapshots')
    }), /exact injected SQLite connection/);
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    assert.equal(tables.has('workspace_write_receipts'), false);
    assert.equal(tables.has('case01_snapshot_reservations'), false);
  } finally {
    database.close();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
