#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-runtime-packed-consumer-'));
const consumerRoot = path.join(temporaryRoot, 'consumer');
const environment = {
  ...process.env,
  npm_config_update_notifier: 'false',
  npm_config_fund: 'false',
  npm_config_audit: 'false'
};
function run(command, args, cwd, label) {
  const result = spawnSync(command, args, {
    cwd, env: environment, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (status=${result.status}, signal=${result.signal}):\n${result.stdout || ''}\n${result.stderr || ''}\n${result.error?.message || ''}`);
  }
  return result.stdout.trim();
}
try {
  fs.mkdirSync(consumerRoot, { mode: 0o700 });
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temporaryRoot], ROOT, 'npm pack'));
  assert.equal(packed.length, 1);
  assert.equal(packed[0].name, '@runalith/workspace-runtime');
  assert.equal(packed[0].version, '0.1.0');
  const tarball = path.join(temporaryRoot, packed[0].filename);
  assert.ok(fs.statSync(tarball).size > 10_000);
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', consumerRoot, tarball], ROOT,
    'install packed Workspace Runtime into clean consumer');

  const smoke = `
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    import { DatabaseSync } from 'node:sqlite';
    const api = await import('@runalith/workspace-runtime');
    assert.equal(api.WORKSPACE_RUNTIME_COMPOSITION_VERSION, 1);
    assert.equal(api.WORKSPACE_WORKFLOW_PORT_VERSION, 1);
    assert.equal(api.CASE01_WORKFLOW_PORT_VERSION, 1);
    assert.equal(typeof api.createWorkspaceRuntime, 'function');
    assert.equal(typeof api.createWorkspaceWorkflowPort, 'function');
    assert.equal(typeof api.createCase01SnapshotService, 'function');
    assert.equal(typeof api.replaceFileWithin, 'function');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-consumer-smoke-'));
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { mode: 0o700 });
    fs.writeFileSync(path.join(workspace, 'before.txt'), 'before');
    const replaced = api.replaceFileWithin(workspace, 'before.txt', 'after', {
      expectedSha256: createHash('sha256').update('before').digest('hex')
    });
    assert.equal(replaced.changed, true);
    assert.equal(replaced.outcome, 'replaced');
    assert.equal(fs.readFileSync(path.join(workspace, 'before.txt'), 'utf8'), 'after');

    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys=ON; CREATE TABLE jobs(job_id TEXT PRIMARY KEY); CREATE TABLE tasks(task_id TEXT PRIMARY KEY); CREATE TABLE results(result_id TEXT PRIMARY KEY); CREATE TABLE artifacts(artifact_id TEXT PRIMARY KEY); CREATE TABLE attempts(attempt_id TEXT PRIMARY KEY);');
    const methods = names => Object.fromEntries(names.map(name => [name, () => null]));
    const workspaceWorkflowPort = methods(api.WORKSPACE_WORKFLOW_PORT_METHODS);
    workspaceWorkflowPort.assertSharedConnection = connection => connection === database;
    const case01WorkflowPort = methods(api.CASE01_WORKFLOW_PORT_METHODS);
    case01WorkflowPort.assertSharedConnection = connection => connection === database;
    const filesystemPort = api.createWorkspaceFilesystemPort({
      workspaceWriteScopeForRole: () => null,
      pathIsWithinWorkspaceWriteScope: () => false
    });
    const runtime = api.createWorkspaceRuntime({
      database, workspaceWorkflowPort, case01WorkflowPort, workspaceFilesystemPort: filesystemPort,
      snapshotBase: path.join(root, 'snapshots'), env: { NODE_ENV: 'test' }
    });
    assert.equal(runtime.version, 1);
    assert.equal(Object.isFrozen(runtime), true);
    for (const table of ['workspace_write_receipts', 'workspace_write_intents', 'case01_snapshot_reservations', 'case01_consumption_acks']) {
      assert.equal(database.prepare('SELECT 1 AS ok FROM sqlite_master WHERE type=? AND name=?').get('table', table)?.ok, 1);
    }
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
    console.log('packed consumer public API, Linux filesystem module and shared-connection composition PASS');
  `;
  run(process.execPath, ['--input-type=module', '-e', smoke], consumerRoot, 'packed consumer API smoke');
  console.log(`Workspace Runtime packed consumer PASS: ${packed[0].filename} (${packed[0].entryCount} package files, ${packed[0].size} bytes)`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
