# TON Mass Wallet Studio (Production Edition)

A high-performance, production-ready desktop suite for batch TON wallet generation, mass transactions, jetton distribution, gas balancing, NFT dispersion, and master vault management.

---

## 🚀 Quick Start & Launching the App

### 1. Desktop Icon (Double-Click)
- You can simply **double-click the "TON Mass Wallet Studio" icon on your Desktop** to launch the app in standalone native app mode!

### 2. Command-Line Launch
From this directory:
```bash
./start.sh
```
Or with npm:
```bash
npm start
```

### 3. Stopping the Server
```bash
./stop.sh
```

### 4. Restarting the Server
```bash
./restart.sh
```

---

## ✨ Features & Capabilities

- ⚡ **Mass Wallet Generator**: Generate hundreds or thousands of TON wallets (v4R2, v3R2, W5 / v5R1) in parallel in seconds.
- 🔐 **Zero-Knowledge Security**: Cryptographic operations occur strictly client-side. No seed phrases or private keys are ever transmitted over external networks.
- 🗄️ **Multi-Tier Persistence**:
  - **IndexedDB**: High-speed local database.
  - **LocalStorage**: Redundant local fallback.
  - **Local Node Storage Sync**: Automatic sync to local file storage and `~/Downloads` auto-recovery.
  - **PIN Protection & AES Encryption**: Lock your master vault with a passphrase (PBKDF2-SHA256, 200k iterations + AES-256). When locked, the local server only ever stores an opaque encrypted blob — it cannot read your seed phrases.
- 💸 **Treasury & Mass Send**:
  - Main treasury distribution to all subwallets.
  - Mass sends and gas balancing across all managed wallets.
  - Jetton transfers (USDT, NOT, DOGS, HMSTR, GRAM).
- 🖼️ **Mass NFT Operations**:
  - NFT Gallery & Collectibles viewer.
  - Mass NFT Disperse & individual NFT transfers.
- 📥 **Flexible Bulk Importer**:
  - Paste raw 24-word seed phrases.
  - Raw private keys / hex pairs.
  - CSV / JSON backup imports.
- 📤 **Custom Exporting**:
  - Full Master Vault Backup (.json).
  - Clean address lists (.txt).
  - Keyphrase & Address recovery sheets (.txt).
  - Formatted CSV tables for Excel / Sheets.

---

## 🛠️ Development & Building

If you ever make modifications to the UI code in `src/`:

```bash
# Rebuild production assets
npm run build

# Or run in live Vite development mode
npm run dev
```

---

## 📁 Project Structure

```
TON-Mass-Wallet/
├── dist/                      # Compiled production frontend bundle
├── src/                       # TypeScript React source code
│   ├── components/            # UI Modals, Cards, and Views
│   ├── services/              # TonService, StorageService, PriceService, etc.
│   └── types/                 # TypeScript interfaces and definitions
├── public/                    # Static icons and assets
├── logs/                      # Server logs and runtime PID
├── server.js                  # Standalone lightweight production HTTP/API server
├── start.sh                   # Main production launcher (Linux)
├── stop.sh                    # Graceful shutdown script
├── restart.sh                 # Restart script
├── start.bat                  # Windows launch script
├── TON-Mass-Wallet.desktop    # Desktop shortcut entry
├── icon.png                   # High-res application icon (512x512)
└── package.json               # Project manifest
```

## 🔒 Security Notes (2026-10-07 hardening)

- **Loopback by default**: `server.js` binds to `127.0.0.1`. The vault API (`/api/wallets`) is only reachable from the same machine. Override with `HOST=0.0.0.0` only if you understand the exposure — the API has no authentication.
- **No wildcard CORS**: the UI is served same-origin; cross-origin browser access to the API is not permitted.
- **Encrypted vault sync**: with a vault passphrase set, every write path (IndexedDB, localStorage, server file) stores only the PBKDF2+AES-256 encrypted blob. The server never sees plaintext secrets and cannot decrypt them. Without a passphrase, the local `vault_wallets.json` holds plaintext — treat that file like cash.
- **Backup restores** are restricted to files inside `~/Downloads` (prefix check with trailing separator + is-file verification).
- **Exports are plaintext by design**: CSV/JSON/TXT exports contain seed phrases. They are written to `~/Downloads` — encrypt or delete them when done.
