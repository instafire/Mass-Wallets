import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isFileWithinDirectory, writeVaultFileAtomically } from '../vaultFile.js';

test('writes vault JSON atomically with owner-only POSIX permissions', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mass-wallet-vault-'));
  try {
    const file = path.join(dir, 'vault_wallets.json');
    const record = { encrypted: true, payload: 'test-only' };
    writeVaultFileAtomically(file, record);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), record);
    assert.deepEqual(readdirSync(dir), ['vault_wallets.json']);
    if (process.platform !== 'win32') {
      assert.equal(statSync(file).mode & 0o777, 0o600);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects symlinks escaping the permitted backup directory', () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'mass-wallet-restore-'));
  const downloads = path.join(parent, 'Downloads');
  const elsewhere = path.join(parent, 'outside');
  try {
    const insideFile = path.join(downloads, 'backup.json');
    const outsideFile = path.join(elsewhere, 'secret.json');
    const escapeLink = path.join(downloads, 'linked.json');
    const unrelatedPath = path.join(parent, 'elsewhere.json');
    mkdirSync(downloads);
    mkdirSync(elsewhere);
    writeFileSync(insideFile, '{}');
    writeFileSync(outsideFile, '{}');
    writeFileSync(unrelatedPath, '{}');
    symlinkSync(outsideFile, escapeLink);

    assert.equal(isFileWithinDirectory(insideFile, downloads), true);
    assert.equal(isFileWithinDirectory(escapeLink, downloads), false);
    assert.equal(isFileWithinDirectory(unrelatedPath, downloads), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
