import CryptoJS from 'crypto-js';
import type { ManagedWallet, VaultConfig, WalletBackupExport, Network, NetworkBalanceData } from '../types';

const STORAGE_KEY_WALLETS = 'tonkeeper_mass_wallets_v2';
const STORAGE_KEY_BACKUP_ALT = 'tonkeeper_mass_wallets_backup_v2';
const STORAGE_KEY_VAULT = 'tonkeeper_vault_config_v2';

const LEGACY_STORAGE_KEYS = [
  'tonkeeper_mass_wallets_v2',
  'tonkeeper_mass_wallets_backup_v2',
  'tonkeeper_mass_wallets',
  'tonkeeper_mass_wallets_backup',
  'tongram_wallets_v2',
  'tongram_wallets',
  'tongram_mass_wallets',
  'ton_mass_wallets_v2',
  'ton_mass_wallets',
  'tonkeeper_wallets',
  'tonkeeper_vault',
  'wallets',
];

const DB_NAME = 'TonMassWalletDB';
const DB_VERSION = 1;
const STORE_NAME = 'wallets_store';

// ---------------------------------------------------------------------------
// Vault encryption
//
// A PIN/passphrase set in VaultSecurityModal protects secrets at rest.
// Key derivation: PBKDF2-SHA256, 200k iterations, random 128-bit salt.
// Payload v2: { encrypted: true, v: 2, kdf, iter, salt, data }.
//
// SECURITY CONTRACT (fixed 2026-10-07 — previously the PIN only encrypted
// the browser copy while every save POSTed plaintext mnemonics to the local
// server file):
//  - When a PIN is active (sessionPin set), the server sync sends ONLY the
//    opaque encrypted blob. The server never sees plaintext secrets and
//    cannot decrypt them.
//  - persistWallets() no longer strips the PIN: saveWallets() falls back to
//    the session PIN automatically, so every write path stays encrypted.
// ---------------------------------------------------------------------------

let sessionPin: string | null = null;
// Derived key cache: PBKDF2 at 200k iterations costs ~2s, so derive once per
// session and reuse. Memory-only, cleared with the session PIN.
const sessionKeyCache = new Map<string, string>();

/** Remember the PIN for this browser session after unlock / PIN creation. Never persisted. */
export function setSessionPin(pin: string | null): void {
  sessionPin = pin && pin.trim().length >= 4 ? pin.trim() : null;
  sessionKeyCache.clear();
  // Prime the cache so the first save after unlock isn't slow.
  if (sessionPin) {
    const salt = getVaultSalt();
    sessionKeyCache.set(salt, deriveKey(sessionPin, salt));
  }
}

export function clearSessionPin(): void {
  sessionPin = null;
  sessionKeyCache.clear();
}

export function hasSessionPin(): boolean {
  return sessionPin !== null;
}

/** One stable salt per vault, stored in the vault config. */
function getVaultSalt(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VAULT);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.pinSalt) return cfg.pinSalt;
      const s = newSalt();
      cfg.pinSalt = s;
      localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(cfg));
      return s;
    }
  } catch { /* fall through */ }
  return newSalt();
}

function getSessionKey(salt: string): string | null {
  if (!sessionPin) return null;
  let k = sessionKeyCache.get(salt);
  if (!k) {
    k = deriveKey(sessionPin, salt);
    sessionKeyCache.set(salt, k);
  }
  return k;
}

const PBKDF2_ITER = 200000;

function deriveKey(pin: string, saltHex: string): string {
  return CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(saltHex), {
    keySize: 256 / 32,
    iterations: PBKDF2_ITER,
    hasher: CryptoJS.algo.SHA256,
  }).toString(CryptoJS.enc.Hex);
}

function newSalt(): string {
  return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
}

/** Constant-time string comparison for hash verifiers. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface EncryptedPayloadV2 {
  encrypted: true;
  v: 2;
  kdf: 'pbkdf2-sha256';
  iter: number;
  salt: string;
  data: string; // AES-256-CBC hex of the JSON wallet array, key = deriveKey(pin, salt)
  timestamp: number;
}

function encryptWalletsV2(jsonString: string, pin: string): string {
  const salt = getVaultSalt();
  // Prefer the session-derived key (fast); fall back to a fresh derivation
  // when encrypting outside an active session (e.g. setVaultPin primes it).
  const keyHex = getSessionKey(salt) || deriveKey(pin, salt);
  // NOTE: crypto-js 4.x does not auto-generate an IV when the key is a
  // WordArray — pass one explicitly (verified by execution, not just types).
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(jsonString, CryptoJS.enc.Hex.parse(keyHex), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // Store IV + ciphertext together
  const payload: EncryptedPayloadV2 = {
    encrypted: true,
    v: 2,
    kdf: 'pbkdf2-sha256',
    iter: PBKDF2_ITER,
    salt,
    data: encrypted.iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    timestamp: Date.now(),
  };
  return JSON.stringify(payload);
}

function decryptWalletsV2(payload: EncryptedPayloadV2, pin: string): string | null {
  try {
    // If this PIN already armed the session, reuse the cached derived key.
    const keyHex = (sessionPin && pin.trim() === sessionPin && sessionKeyCache.get(payload.salt))
      || deriveKey(pin.trim(), payload.salt);
    const [ivHex, ctHex] = payload.data.split(':');
    if (!ivHex || !ctHex) return null;
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Hex.parse(ctHex) } as any,
      CryptoJS.enc.Hex.parse(keyHex),
      { iv: CryptoJS.enc.Hex.parse(ivHex), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    const out = decrypted.toString(CryptoJS.enc.Utf8);
    return out || null;
  } catch {
    return null;
  }
}

/** Legacy v1 decrypt: CryptoJS.AES.encrypt(json, pin) with EVP_BytesToKey. Kept for old vaults only. */
function decryptWalletsV1(data: string, pin: string): string | null {
  try {
    const out = CryptoJS.AES.decrypt(data, pin.trim()).toString(CryptoJS.enc.Utf8);
    return out || null;
  } catch {
    return null;
  }
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: any): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB set error:', err);
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete error:', err);
  }
}

export function normalizeWallet(w: any): ManagedWallet {
  const mnemonicArr: string[] = Array.isArray(w.mnemonic)
    ? w.mnemonic
    : typeof w.mnemonic === 'string'
      ? w.mnemonic.trim().split(/\s+/)
      : [];

  const createdAtNum: number = typeof w.createdAt === 'number'
    ? w.createdAt
    : typeof w.createdAt === 'string'
      ? new Date(w.createdAt).getTime() || Date.now()
      : Date.now();

  const defaultJettons = Array.isArray(w.jettons) ? w.jettons : [];
  const defaultNfts = Array.isArray(w.nfts) ? w.nfts : [];

  const mainnetData: NetworkBalanceData = w.networkBalances?.mainnet || {
    ton: typeof w.balance === 'string' ? w.balance : '0.00',
    tonNano: typeof w.balanceNano === 'string' ? w.balanceNano : '0',
    jettons: defaultJettons,
    nfts: defaultNfts,
  };

  const testnetData: NetworkBalanceData = w.networkBalances?.testnet || {
    ton: '0.00',
    tonNano: '0',
    jettons: [],
    nfts: [],
  };

  // Preserve current balance and NFTs if valid, else fall back to mainnet
  const activeBalance = typeof w.balance === 'string' ? w.balance : mainnetData.ton;
  const activeBalanceNano = typeof w.balanceNano === 'string' ? w.balanceNano : mainnetData.tonNano;
  const activeJettons = Array.isArray(w.jettons) ? w.jettons : (mainnetData.jettons || []);
  const activeNfts = Array.isArray(w.nfts) ? w.nfts : (mainnetData.nfts || []);

  const detectedChain = w.chain || (
    w.version === 'solana-ed25519' || 
    w.version === 'squads-v4' || 
    (w.address && !w.address.startsWith('EQ') && !w.address.startsWith('UQ') && !w.address.includes(':'))
      ? 'solana' 
      : 'ton'
  );

  return {
    id: w.id || `w_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    chain: detectedChain,
    label: w.label || 'Wallet',
    tag: w.tag || 'General',
    version: w.version || 'v4R2',
    subwalletId: typeof w.subwalletId === 'number' ? w.subwalletId : 698983191,
    address: w.address || '',
    rawAddress: w.rawAddress || w.address || '',
    publicKey: w.publicKey || '',
    privateKey: w.privateKey || undefined,
    privateKeyHex: w.privateKeyHex || undefined,
    squadsVaultAddress: w.squadsVaultAddress || undefined,
    squadsMultisigPda: w.squadsMultisigPda || undefined,
    squadsProgramId: w.squadsProgramId || undefined,
    mnemonic: mnemonicArr,
    createdAt: createdAtNum,
    balance: activeBalance,
    balanceNano: activeBalanceNano,
    jettons: activeJettons,
    nfts: activeNfts,
    networkBalances: {
      mainnet: {
        ...mainnetData,
        ton: activeBalance,
        tonNano: activeBalanceNano,
        jettons: activeJettons,
        nfts: mainnetData.nfts || defaultNfts,
      },
      testnet: {
        ...testnetData,
        nfts: testnetData.nfts || [],
      },
    },
    isMainWallet: !!w.isMainWallet,
    isCustomImport: !!w.isCustomImport,
    lastChecked: w.lastChecked || undefined,
  };
}

export function normalizeWallets(list: any[]): ManagedWallet[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeWallet);
}

export class StorageService {
  /**
   * Save wallets array to IndexedDB, LocalStorage, and sync to backend.
   * If a PIN is provided (or a session PIN is active), everything — including
   * the server sync — stores only the encrypted blob. Plaintext secrets never
   * leave this function when the vault is locked.
   */
  public static saveWallets(wallets: ManagedWallet[], pin?: string): void {
    // Demo/sample NFTs (id prefix `demo_`) are exploration aids only — never
    // persist them into the vault file.
    const withoutDemos = wallets.map(w =>
      w.nfts && w.nfts.some(n => typeof n.id === 'string' && n.id.startsWith('demo_'))
        ? { ...w, nfts: w.nfts.filter(n => !(typeof n.id === 'string' && n.id.startsWith('demo_'))) }
        : w
    );
    const normalized = normalizeWallets(withoutDemos);
    const jsonString = JSON.stringify(normalized);

    const effectivePin = pin && pin.trim().length >= 4 ? pin.trim() : sessionPin;

    let payloadToStore: string;
    let isEnc = false;

    if (effectivePin) {
      payloadToStore = encryptWalletsV2(jsonString, effectivePin);
      isEnc = true;
    } else {
      payloadToStore = JSON.stringify({ encrypted: false, data: jsonString, timestamp: Date.now() });
    }

    // 1. Save to IndexedDB
    idbSet('wallets_payload', { encrypted: isEnc, raw: payloadToStore, wallets: isEnc ? [] : normalized, timestamp: Date.now() });

    // 2. Save to LocalStorage
    try {
      localStorage.setItem(STORAGE_KEY_WALLETS, payloadToStore);
      localStorage.setItem(STORAGE_KEY_BACKUP_ALT, payloadToStore);
    } catch (e) {
      console.warn('LocalStorage quota limit reached; IndexedDB holds primary copy.', e);
    }

    // 3. Sync to local backend API asynchronously.
    // When encrypted, the server gets the OPAQUE BLOB ONLY — never plaintext
    // wallets. The server stores it as-is and cannot decrypt it.
    try {
      const config = this.getVaultConfig();
      const body = isEnc
        ? { encrypted: true, payload: payloadToStore, vaultConfig: config }
        : { wallets: normalized, vaultConfig: config };
      fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {
        // Silently catch fetch errors (e.g. static production preview)
      });
    } catch {
      // Ignore background sync errors
    }
  }

  /**
   * Parse stored string / payload safely.
   * Handles: v2 PBKDF2 payloads, legacy v1 PIN payloads, plaintext arrays.
   */
  public static parseStoredData(item: string, pin?: string): { wallets: ManagedWallet[]; isEncrypted: boolean; error?: string } {
    try {
      const parsed = JSON.parse(item);

      // Raw array
      if (Array.isArray(parsed)) {
        return { wallets: normalizeWallets(parsed), isEncrypted: false };
      }

      // Object with .wallets array
      if (Array.isArray(parsed.wallets)) {
        return { wallets: normalizeWallets(parsed.wallets), isEncrypted: false };
      }

      // Encrypted payload (v2 PBKDF2 or legacy v1)
      if (parsed.encrypted) {
        if (!pin) {
          return { wallets: [], isEncrypted: true };
        }
        // v2 first
        if (parsed.v === 2 && parsed.salt && parsed.data) {
          const decryptedStr = decryptWalletsV2(parsed as EncryptedPayloadV2, pin.trim());
          if (decryptedStr) {
            const rawWallets = JSON.parse(decryptedStr);
            const list = Array.isArray(rawWallets) ? rawWallets : (rawWallets.wallets || []);
            return { wallets: normalizeWallets(list), isEncrypted: true };
          }
          return { wallets: [], isEncrypted: true, error: 'Incorrect PIN code' };
        }
        // legacy v1 fallback (CryptoJS passphrase format)
        try {
          const decryptedStr = decryptWalletsV1(parsed.data, pin.trim());
          if (decryptedStr) {
            const rawWallets = JSON.parse(decryptedStr);
            const list = Array.isArray(rawWallets) ? rawWallets : (rawWallets.wallets || []);
            return { wallets: normalizeWallets(list), isEncrypted: true };
          }
        } catch { /* fall through to error */ }
        return { wallets: [], isEncrypted: true, error: 'Incorrect PIN code' };
      }

      // Unencrypted container with .data
      if (parsed.data) {
        let extracted: any[] = [];
        if (typeof parsed.data === 'string') {
          extracted = JSON.parse(parsed.data);
        } else if (Array.isArray(parsed.data)) {
          extracted = parsed.data;
        }
        return { wallets: normalizeWallets(extracted), isEncrypted: false };
      }

      return { wallets: [], isEncrypted: false };
    } catch (e) {
      console.error('Failed to parse storage item:', e);
      return { wallets: [], isEncrypted: false, error: 'Corrupt storage data' };
    }
  }

  /**
   * Load wallets synchronously from LocalStorage (checking all fallback keys)
   */
  public static loadWallets(pin?: string): { wallets: ManagedWallet[]; isEncrypted: boolean; error?: string } {
    try {
      for (const key of LEGACY_STORAGE_KEYS) {
        const item = localStorage.getItem(key);
        if (item && item.trim().length > 2) {
          const res = this.parseStoredData(item, pin);
          if (res.wallets.length > 0 || res.isEncrypted) {
            return res;
          }
        }
      }

      return { wallets: [], isEncrypted: false };
    } catch (e) {
      console.error('Failed to load wallets from storage:', e);
      return { wallets: [], isEncrypted: false, error: 'Corrupt storage data' };
    }
  }

  /**
   * Comprehensive async loader: Checks Backend API -> IndexedDB -> LocalStorage
   * Authoritative backend API (/api/wallets) is checked first when running with local server.
   */
  public static async loadAllWalletsAsync(pin?: string): Promise<{ wallets: ManagedWallet[]; isEncrypted: boolean; config: VaultConfig }> {
    const config = this.getVaultConfig();

    // 1. Try Backend API (/api/wallets) first if available
    try {
      const resp = await fetch('/api/wallets');
      if (resp.ok) {
        const json = await resp.json();
        const serverConfig: VaultConfig = json.vaultConfig || config;

        if (json && json.encrypted === true && typeof json.payload === 'string') {
          // Encrypted vault on server: seed the local encrypted caches
          try {
            localStorage.setItem(STORAGE_KEY_WALLETS, json.payload);
            localStorage.setItem(STORAGE_KEY_BACKUP_ALT, json.payload);
          } catch { /* quota — IndexedDB still primary */ }
          await idbSet('wallets_payload', { encrypted: true, raw: json.payload, wallets: [], timestamp: Date.now() });
          if (serverConfig) {
            localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(serverConfig));
          }
          if (pin) {
            const parsed = this.parseStoredData(json.payload, pin);
            if (parsed.wallets.length > 0) {
              return { wallets: parsed.wallets, isEncrypted: true, config: serverConfig };
            }
          }
          return { wallets: [], isEncrypted: true, config: serverConfig };
        }

        if (json && Array.isArray(json.wallets) && json.wallets.length > 0) {
          const normalized = normalizeWallets(json.wallets);

          // Update local IndexedDB & LocalStorage so offline mode stays in sync with server truth
          await idbSet('wallets_payload', { 
            encrypted: false, 
            raw: JSON.stringify({ encrypted: false, data: JSON.stringify(normalized), timestamp: Date.now() }), 
            wallets: normalized, 
            timestamp: Date.now() 
          });
          try {
            localStorage.setItem(STORAGE_KEY_WALLETS, JSON.stringify({ encrypted: false, data: JSON.stringify(normalized), timestamp: Date.now() }));
          } catch { /* quota */ }
          if (serverConfig) {
            localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(serverConfig));
          }

          return { wallets: normalized, isEncrypted: false, config: serverConfig };
        }
      }
    } catch (err) {
      console.warn('Backend API auto-load skipped or unavailable, falling back to local storage:', err);
    }

    // 2. Try IndexedDB
    try {
      const idbData: any = await idbGet('wallets_payload');
      if (idbData) {
        if (idbData.encrypted) {
          if (pin) {
            const parsed = this.parseStoredData(idbData.raw, pin);
            if (parsed.wallets.length > 0) {
              return { wallets: parsed.wallets, isEncrypted: true, config };
            }
          } else {
            return { wallets: [], isEncrypted: true, config };
          }
        } else if (Array.isArray(idbData.wallets) && idbData.wallets.length > 0) {
          return { wallets: normalizeWallets(idbData.wallets), isEncrypted: false, config };
        }
      }
    } catch (err) {
      console.warn('Error reading from IndexedDB:', err);
    }

    // 3. Try LocalStorage
    const localRes = this.loadWallets(pin);
    if (localRes.wallets.length > 0 || localRes.isEncrypted) {
      // Sync to IndexedDB for safety
      if (localRes.wallets.length > 0 && !localRes.isEncrypted) {
        idbSet('wallets_payload', { encrypted: false, wallets: localRes.wallets, timestamp: Date.now() });
      }
      return { wallets: localRes.wallets, isEncrypted: localRes.isEncrypted, config };
    }

    return { wallets: [], isEncrypted: false, config };
  }

  /**
   * Check if vault is currently encrypted with PIN
   */
  public static isVaultEncrypted(): boolean {
    const config = this.getVaultConfig();
    if (config.hasPin) return true;
    try {
      const item = localStorage.getItem(STORAGE_KEY_WALLETS);
      if (item) {
        try {
          const parsed = JSON.parse(item);
          if (parsed.encrypted) return true;
        } catch {}
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get vault configuration
   */
  public static getVaultConfig(): VaultConfig {
    try {
      const item = localStorage.getItem(STORAGE_KEY_VAULT);
      if (!item) return { isLocked: false, hasPin: false };
      return JSON.parse(item);
    } catch {
      return { isLocked: false, hasPin: false };
    }
  }

  public static clearAllWallets(): void {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(STORAGE_KEY_VAULT);
    idbDelete('wallets_payload');
    
    // Also notify backend
    try {
      fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets: [], vaultConfig: { isLocked: false, hasPin: false } }),
      }).catch(() => {});
    } catch {}
  }

  /**
   * Set or update Vault PIN protection.
   * Stores a PBKDF2 verifier (salt + derived hash) — never the PIN, never a
   * fast unsalted hash. Also arms the session PIN so subsequent saves stay
   * encrypted without re-prompting.
   */
  public static setVaultPin(wallets: ManagedWallet[], newPin: string): void {
    const pin = newPin.trim();
    const salt = newSalt();
    const verifier = deriveKey(pin, salt); // PBKDF2-SHA256, 200k iterations
    const config: VaultConfig = {
      isLocked: false,
      hasPin: true,
      pinHash: verifier,
      pinSalt: salt,
      pinKdf: 'pbkdf2-sha256',
      lastBackupAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(config));
    setSessionPin(pin);
    this.saveWallets(wallets, pin);
  }

  /**
   * Remove Vault PIN protection
   */
  public static removeVaultPin(wallets: ManagedWallet[]): void {
    localStorage.removeItem(STORAGE_KEY_VAULT);
    clearSessionPin();
    this.saveWallets(wallets); // saves unencrypted
  }

  /**
   * Verify PIN code against stored verifier (constant-time).
   * Legacy vaults with a plain SHA-256 pinHash still verify via the old path.
   */
  public static verifyPin(pin: string): boolean {
    const config = this.getVaultConfig();
    if (!config.hasPin || !config.pinHash) return true;
    const input = pin.trim();
    if (config.pinKdf === 'pbkdf2-sha256' && config.pinSalt) {
      const candidate = deriveKey(input, config.pinSalt);
      return constantTimeEqual(candidate, config.pinHash);
    }
    // legacy: unsalted SHA-256
    const legacy = CryptoJS.SHA256(input).toString();
    return constantTimeEqual(legacy, config.pinHash);
  }

  /**
   * Verify the PIN and, on success, arm the session (PIN + derived key cached).
   * Use this for unlock flows so subsequent decrypt/encrypt calls don't
   * re-run PBKDF2.
   */
  public static verifyAndUnlock(pin: string): boolean {
    const ok = this.verifyPin(pin);
    if (ok) setSessionPin(pin.trim());
    return ok;
  }

  /**
   * Export Full Master Backup JSON File
   */
  public static exportFullMasterBackup(
    wallets: ManagedWallet[], 
    network: Network = 'mainnet',
    filename: string = `master_vault_backup_${Date.now()}.json`
  ): void {
    const exportData: WalletBackupExport = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      network,
      totalWallets: wallets.length,
      wallets: wallets.map((w, idx) => ({
        index: idx + 1,
        id: w.id,
        chain: w.chain || 'ton',
        label: w.label,
        tag: w.tag,
        version: w.version,
        subwalletId: w.subwalletId,
        address: w.address,
        rawAddress: w.rawAddress,
        publicKey: w.publicKey,
        privateKey: w.privateKey,
        squadsVaultAddress: w.squadsVaultAddress,
        mnemonic: w.mnemonic.join(' '),
        createdAt: new Date(w.createdAt).toISOString(),
        isMainWallet: w.isMainWallet || false,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Alias for exportFullMasterBackup to support exportToJSON calls
   */
  public static exportToJSON(wallets: ManagedWallet[], filename?: string): void {
    this.exportFullMasterBackup(wallets, 'mainnet', filename);
  }

  /**
   * Export plain list of addresses to TXT
   */
  public static exportAddressesTXT(wallets: ManagedWallet[], filename: string = `addresses_${Date.now()}.txt`): void {
    const content = wallets.map(w => w.address).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Export plain list of private keys (Base58 for Solana, mnemonic for TON)
   */
  public static exportPrivateKeysTXT(wallets: ManagedWallet[], filename: string = `private_keys_${Date.now()}.txt`): void {
    const content = wallets.map(w => w.privateKey || w.mnemonic.join(' ')).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Export Keyphrase + Address Pairs to TXT File
   */
  public static exportPairsTXT(wallets: ManagedWallet[], filename: string = `keyphrases_and_addresses_${Date.now()}.txt`): void {
    const lines = wallets.map((w, idx) => {
      const pKeyLine = w.privateKey ? `Private Key (Base58): ${w.privateKey}\n` : '';
      const squadsLine = w.squadsVaultAddress ? `Squads v4 Vault PDA: ${w.squadsVaultAddress}\n` : '';
      return `[Wallet #${idx + 1} - ${w.label} (${w.chain?.toUpperCase() || 'TON'} - ${w.version})]\nAddress: ${w.address}\n${pKeyLine}${squadsLine}Keyphrase: ${w.mnemonic.join(' ')}\nPublic Key: ${w.publicKey}\n`;
    });
    const content = `=====================================================\nMASS WALLET STUDIO - MASTER RECOVERY BACKUP\nExported: ${new Date().toLocaleString()}\nTotal Wallets: ${wallets.length}\n=====================================================\n\n` + lines.join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Export Managed Wallets to CSV
   */
  public static exportToCSV(wallets: ManagedWallet[], filename: string = `wallets_${Date.now()}.csv`): void {
    const headers = ['Index', 'Chain', 'Label', 'Tag', 'Address', 'Version', 'Private Key (Base58)', 'Squads v4 Vault', 'Keyphrase', 'Public Key', 'Created At'];
    const rows = wallets.map((w, idx) => [
      idx + 1,
      `"${w.chain || 'ton'}"`,
      `"${w.label.replace(/"/g, '""')}"`,
      `"${w.tag.replace(/"/g, '""')}"`,
      `"${w.address}"`,
      `"${w.version}"`,
      `"${(w.privateKey || '').replace(/"/g, '""')}"`,
      `"${(w.squadsVaultAddress || '').replace(/"/g, '""')}"`,
      `"${w.mnemonic.join(' ')}"`,
      `"${w.publicKey}"`,
      `"${new Date(w.createdAt).toLocaleString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

