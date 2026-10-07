import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function walletStoragePlugin(): Plugin {
  const storeFilePath = path.resolve(process.cwd(), 'vault_wallets.json');

  const getDownloadsBackups = () => {
    const downloadsDir = path.resolve(os.homedir(), 'Downloads');
    if (!fs.existsSync(downloadsDir)) return [];
    try {
      const files = fs.readdirSync(downloadsDir);
      return files
        .filter(f => (f.startsWith('tonkeeper_master_vault_backup_') || f.startsWith('master_vault_')) && f.endsWith('.json'))
        .map(f => {
          const fullPath = path.join(downloadsDir, f);
          const stat = fs.statSync(fullPath);
          return {
            filename: f,
            fullPath,
            sizeBytes: stat.size,
            mtimeMs: stat.mtimeMs,
            updatedAt: new Date(stat.mtimeMs).toISOString(),
          };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    } catch {
      return [];
    }
  };

  return {
    name: 'wallet-storage-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        // GET /api/wallets
        if (url === '/api/wallets' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          
          if (fs.existsSync(storeFilePath)) {
            try {
              const content = fs.readFileSync(storeFilePath, 'utf8');
              const parsed = JSON.parse(content);
              return res.end(JSON.stringify({ success: true, source: 'local_file', ...parsed }));
            } catch (err: any) {
              console.error('Error reading vault_wallets.json:', err);
            }
          }

          // If no local file, try finding latest backup in ~/Downloads
          const backups = getDownloadsBackups();
          if (backups.length > 0) {
            try {
              const latest = backups[0];
              const content = fs.readFileSync(latest.fullPath, 'utf8');
              const parsed = JSON.parse(content);
              // Save to store file
              fs.writeFileSync(storeFilePath, JSON.stringify(parsed, null, 2), 'utf8');
              return res.end(JSON.stringify({
                success: true,
                source: 'download_backup',
                backupFile: latest.filename,
                ...parsed,
              }));
            } catch (err: any) {
              console.error('Error loading latest backup:', err);
            }
          }

          return res.end(JSON.stringify({ success: true, wallets: [], totalWallets: 0, vaultConfig: { isLocked: false, hasPin: false } }));
        }

        // POST /api/wallets
        if (url === '/api/wallets' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
            if (body.length > 50 * 1024 * 1024) { req.destroy(); body = ''; }
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              // Accept the opaque encrypted blob when the vault is PIN-locked
              // (same contract as server.js) — never decrypt server-side.
              const toSave = (parsed && parsed.encrypted === true && typeof parsed.payload === 'string')
                ? {
                    version: '2.0.0',
                    updatedAt: new Date().toISOString(),
                    encrypted: true,
                    payload: parsed.payload,
                    totalWallets: 0,
                    vaultConfig: parsed.vaultConfig || { isLocked: false, hasPin: true },
                  }
                : {
                    version: '2.0.0',
                    updatedAt: new Date().toISOString(),
                    encrypted: false,
                    totalWallets: Array.isArray(parsed.wallets) ? parsed.wallets.length : 0,
                    wallets: parsed.wallets || [],
                    vaultConfig: parsed.vaultConfig || { isLocked: false, hasPin: false },
                  };
              fs.writeFileSync(storeFilePath, JSON.stringify(toSave, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, count: toSave.totalWallets }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err?.message || 'Failed to save' }));
            }
          });
          return;
        }

        // GET /api/backups
        if (url === '/api/backups' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const backups = getDownloadsBackups();
          return res.end(JSON.stringify({ success: true, backups }));
        }

        // POST /api/restore-backup
        if (url === '/api/restore-backup' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { filePath } = JSON.parse(body);
              const downloadsDir = path.resolve(os.homedir(), 'Downloads');
              const resolvedPath = path.resolve(filePath);

              // Prevent arbitrary file reads / path traversal (trailing
              // separator matters: ~/Downloads2/x must not pass).
              const downloadsRoot = downloadsDir.endsWith(path.sep) ? downloadsDir : downloadsDir + path.sep;
              let stat = null;
              try { stat = fs.statSync(resolvedPath); } catch { stat = null; }
              if (!filePath || !resolvedPath.startsWith(downloadsRoot) || !stat || !stat.isFile()) {
                res.statusCode = 403;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'Access denied: File must be located in Downloads directory' }));
              }

              const content = fs.readFileSync(resolvedPath, 'utf8');
              const parsed = JSON.parse(content);
              fs.writeFileSync(storeFilePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, ...parsed }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err?.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    walletStoragePlugin(),
  ],
  define: {
    'process.env': {},
  },
})
