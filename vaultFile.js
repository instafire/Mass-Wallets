import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/** Return true only for regular files whose canonical path is inside a directory. */
export function isFileWithinDirectory(filePath, directoryPath) {
  try {
    const root = fs.realpathSync(directoryPath);
    const target = fs.realpathSync(filePath);
    const stat = fs.statSync(target);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    return stat.isFile() && target.startsWith(rootPrefix);
  } catch {
    return false;
  }
}

/** Atomically replace the local vault using a unique owner-readable temp file. */
export function writeVaultFileAtomically(filePath, value) {
  const tempPath = `${filePath}.tmp.${process.pid}.${randomUUID()}`;
  const contents = JSON.stringify(value, null, 2);
  let fd;

  try {
    fd = fs.openSync(tempPath, 'wx', 0o600);
    fs.writeFileSync(fd, contents, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;

    fs.renameSync(tempPath, filePath);
    if (process.platform !== 'win32') {
      fs.chmodSync(filePath, 0o600);
    }
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* preserve the original error */ }
    }
    try { fs.rmSync(tempPath, { force: true }); } catch { /* preserve the original error */ }
    throw error;
  }
}
