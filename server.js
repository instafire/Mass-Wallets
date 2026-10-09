import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { isFileWithinDirectory, writeVaultFileAtomically } from './vaultFile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port / host configuration.
// SECURITY: binds to 127.0.0.1 by default. This server reads and writes the
// plaintext/encrypted master vault (seed phrases). Never expose it to a LAN
// or the public internet. Override with HOST=... only if you know why.
const args = process.argv.slice(2);
let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5173;
const host = process.env.HOST || '127.0.0.1';
const portArgIndex = args.indexOf('--port');
if (portArgIndex !== -1 && args[portArgIndex + 1]) {
  port = parseInt(args[portArgIndex + 1], 10);
}

const DIST_DIR = path.resolve(__dirname, 'dist');
const STORE_FILE = path.resolve(__dirname, 'vault_wallets.json');
const DOWNLOADS_DIR = path.resolve(os.homedir(), 'Downloads');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

// Helper: Scan ~/Downloads for backup files
function getDownloadsBackups() {
  if (!fs.existsSync(DOWNLOADS_DIR)) return [];
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    return files
      .filter(f => (f.startsWith('tonkeeper_master_vault_backup_') || f.startsWith('master_vault_')) && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(DOWNLOADS_DIR, f);
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
  } catch (e) {
    console.error('Error scanning backups:', e);
    return [];
  }
}

// Helper: send JSON response.
// NOTE: no Access-Control-Allow-Origin header is sent on purpose. The UI is
// served same-origin from this server, which needs no CORS. A wildcard would
// let any website or LAN device read/write the vault via /api/wallets.
function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.end(jsonStr);
}

// Helper: read request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let rejected = false;
    const onData = (chunk) => {
      if (rejected) return;
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        // Detach listeners so a slow sender can't keep growing memory after reject
        rejected = true;
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
        req.destroy();
        reject(new Error('Payload too large'));
      }
    };
    const onEnd = () => { if (!rejected) resolve(body); };
    const onError = (e) => { if (!rejected) reject(e); };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

// Helper: Serve static file with compression
function serveStaticFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA client-side routing
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        return serveStaticFile(req, res, indexPath);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Cache header: cache immutable assets for 1 year, html for 0
    let cacheControl = 'public, max-age=31536000, immutable';
    if (ext === '.html' || ext === '.json') {
      cacheControl = 'no-cache, must-revalidate';
    }

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    };

    // Compress text/js/css/json/svg if client supports gzip
    const shouldCompress = /text|javascript|json|svg|xml/.test(contentType);

    if (shouldCompress && acceptEncoding.includes('gzip')) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      const rawStream = fs.createReadStream(filePath);
      const gzipStream = zlib.createGzip();
      rawStream.pipe(gzipStream).pipe(res);
    } else {
      headers['Content-Length'] = stats.size;
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS preflight: only allow same-origin. The UI is served from this
  // server, so cross-origin access is never legitimate.
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // ==========================================
  // API ENDPOINTS
  // ==========================================

  // CSRF / Cross-Origin Security Check for API endpoints:
  // Reject requests coming from unauthorized external websites
  if (pathname.startsWith('/api/')) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        const hostAllowed = parsedOrigin.hostname === 'localhost' || 
                            parsedOrigin.hostname === '127.0.0.1' || 
                            parsedOrigin.hostname === '::1' ||
                            parsedOrigin.hostname === host;
        if (!hostAllowed) {
          return sendJson(res, 403, { success: false, error: 'Forbidden: Cross-origin API request blocked' });
        }
      } catch {
        return sendJson(res, 403, { success: false, error: 'Forbidden: Invalid origin' });
      }
    }
  }

  // 1. Health check
  if (pathname === '/api/health' || pathname === '/api/ping') {
    return sendJson(res, 200, {
      status: 'ok',
      app: 'Mass Wallet',
      version: '2.0.0',
      uptime: process.uptime(),
      port,
    });
  }

// Helper: Sanitize wallets array to strip any demo/sample NFTs
function sanitizeWallets(wallets) {
  if (!Array.isArray(wallets)) return [];
  const isFake = (n) => {
    if (!n || typeof n !== 'object') return false;
    const id = typeof n.id === 'string' ? n.id : '';
    const name = typeof n.name === 'string' ? n.name : '';
    return (
      id.startsWith('demo_') ||
      id.startsWith('sample_') ||
      id.startsWith('nft_sample_') ||
      name.startsWith('demo_nft')
    );
  };
  return wallets.map(w => {
    const cleanNfts = Array.isArray(w.nfts) ? w.nfts.filter(n => !isFake(n)) : [];
    const netBalances = w.networkBalances ? { ...w.networkBalances } : undefined;
    if (netBalances) {
      ['mainnet', 'testnet'].forEach(net => {
        if (netBalances[net] && Array.isArray(netBalances[net].nfts)) {
          netBalances[net] = {
            ...netBalances[net],
            nfts: netBalances[net].nfts.filter(n => !isFake(n)),
          };
        }
      });
    }
    return {
      ...w,
      nfts: cleanNfts,
      ...(netBalances ? { networkBalances: netBalances } : {}),
    };
  });
}

  // 2. GET /api/wallets
  if (pathname === '/api/wallets' && req.method === 'GET') {
    // A) Check local store file
    if (fs.existsSync(STORE_FILE)) {
      try {
        const content = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.wallets)) {
          parsed.wallets = sanitizeWallets(parsed.wallets);
        }
        return sendJson(res, 200, { success: true, source: 'local_file', ...parsed });
      } catch (err) {
        console.error('Error reading vault_wallets.json:', err);
      }
    }

    // B) If no local file, try finding latest backup in ~/Downloads
    const backups = getDownloadsBackups();
    if (backups.length > 0) {
      try {
        const latest = backups[0];
        console.log(`[vault] No local vault file; adopting latest Downloads backup: ${latest.filename}`);
        const content = fs.readFileSync(latest.fullPath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.wallets)) {
          parsed.wallets = sanitizeWallets(parsed.wallets);
        }
        writeVaultFileAtomically(STORE_FILE, parsed);
        return sendJson(res, 200, {
          success: true,
          source: 'download_backup',
          backupFile: latest.filename,
          ...parsed,
        });
      } catch (err) {
        console.error('Error loading latest backup from Downloads:', err);
      }
    }

    // C) Empty response
    return sendJson(res, 200, {
      success: true,
      wallets: [],
      totalWallets: 0,
      vaultConfig: { isLocked: false, hasPin: false },
    });
  }

  // 3. POST /api/wallets
  // Accepts either { wallets: [...], vaultConfig } (legacy plaintext local
  // sync) or { encrypted: true, payload: "<opaque authenticated blob>", vaultConfig }
  // when the vault is passphrase-protected. The server never decrypts v3; old
  // v2 files are migrated by the client after a successful unlock.
  if (pathname === '/api/wallets' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const parsed = JSON.parse(rawBody);

      let toSave;
      let count = 0;
      if (parsed && parsed.encrypted === true && typeof parsed.payload === 'string') {
        toSave = {
          version: '2.0.0',
          updatedAt: new Date().toISOString(),
          encrypted: true,
          payload: parsed.payload,
          totalWallets: 0, // unknown server-side by design
          vaultConfig: parsed.vaultConfig || { isLocked: false, hasPin: true },
        };
      } else {
        const rawWallets = Array.isArray(parsed.wallets) ? parsed.wallets : [];
        const wallets = sanitizeWallets(rawWallets);
        count = wallets.length;
        toSave = {
          version: '2.0.0',
          updatedAt: new Date().toISOString(),
          encrypted: false,
          totalWallets: count,
          wallets,
          vaultConfig: parsed.vaultConfig || { isLocked: false, hasPin: false },
        };
      }

      writeVaultFileAtomically(STORE_FILE, toSave);

      return sendJson(res, 200, { success: true, count, encrypted: !!toSave.encrypted });
    } catch (err) {
      console.error('Error saving wallets:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to save' });
    }
  }

  // 4. GET /api/backups
  if (pathname === '/api/backups' && req.method === 'GET') {
    const backups = getDownloadsBackups();
    return sendJson(res, 200, { success: true, backups });
  }

  // 5. POST /api/restore-backup
  if (pathname === '/api/restore-backup' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const { filePath } = JSON.parse(rawBody);
      if (typeof filePath !== 'string' || filePath.trim() === '') {
        return sendJson(res, 403, { success: false, error: 'Access denied: File must be located in Downloads directory' });
      }
      const resolvedPath = path.resolve(filePath);

      // Security check: restrict restore paths to ~/Downloads.
      // The trailing separator matters: without it, ~/Downloads2/evil.json
      // would pass the prefix check.
      const downloadsRoot = DOWNLOADS_DIR.endsWith(path.sep) ? DOWNLOADS_DIR : DOWNLOADS_DIR + path.sep;
      if (!resolvedPath.startsWith(downloadsRoot) || !isFileWithinDirectory(resolvedPath, DOWNLOADS_DIR)) {
        return sendJson(res, 403, {
          success: false,
          error: 'Access denied: File must be located in Downloads directory',
        });
      }

      const content = fs.readFileSync(resolvedPath, 'utf8');
      const parsed = JSON.parse(content);
      
      // Save to active store
      writeVaultFileAtomically(STORE_FILE, parsed);

      return sendJson(res, 200, { success: true, ...parsed });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err?.message || 'Restore failed' });
    }
  }

  // 6. POST /api/rpc/solana
  // Fast loopback Solana RPC proxy to eliminate browser Origin 403 Forbidden blocks and CORS limits
  if (pathname === '/api/rpc/solana' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      let parsedRpc;
      try {
        parsedRpc = JSON.parse(rawBody);
      } catch {
        return sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: invalid JSON' } });
      }
      if (!parsedRpc || parsedRpc.jsonrpc !== '2.0' || typeof parsedRpc.method !== 'string') {
        return sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request: expected JSON-RPC 2.0 object' } });
      }

      const upstreamEndpoints = [
        'https://solana-rpc.publicnode.com',
        'https://api.mainnet-beta.solana.com'
      ];
      for (const endpoint of upstreamEndpoints) {
        try {
          const upstream = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rawBody,
          });
          if (upstream.ok) {
            const data = await upstream.json();
            return sendJson(res, 200, data);
          }
        } catch {
          // try next endpoint
        }
      }
      return sendJson(res, 502, { jsonrpc: '2.0', error: { code: -32603, message: 'Upstream Solana RPC unreachable' } });
    } catch (err) {
      return sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: err?.message || 'RPC proxy error' } });
    }
  }

  // ==========================================
  // STATIC ASSETS SERVING (Production Build)
  // ==========================================

  // Unknown /api/* paths are a client bug or a probe: 404, don't serve index.html.
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { success: false, error: 'Unknown API endpoint' });
  }

  let decodedPath = '/index.html';
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    decodedPath = '/index.html';
  }
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const targetPath = (normalizedPath === '/' || normalizedPath === '' || normalizedPath === '\\') ? '/index.html' : normalizedPath;
  const staticFilePath = path.resolve(DIST_DIR, '.' + targetPath);

  const distRoot = DIST_DIR.endsWith(path.sep) ? DIST_DIR : DIST_DIR + path.sep;
  if (staticFilePath !== DIST_DIR && !staticFilePath.startsWith(distRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  serveStaticFile(req, res, staticFilePath);
});

// Start Server (loopback only — see HOST note above)
server.listen(port, host, () => {
  console.log(`=======================================================`);
  console.log(`  Mass Wallet - Production Server Running              `);
  console.log(`  Local URL:   http://localhost:${port}               `);
  console.log(`  Bound to:    ${host} (loopback only by default)     `);
  console.log(`  Static Root: ${DIST_DIR}                           `);
  console.log(`=======================================================`);
});

// Graceful termination
process.on('SIGHUP', () => {
  // Ignore SIGHUP when parent terminal closes
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
