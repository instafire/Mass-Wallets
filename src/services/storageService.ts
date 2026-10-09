import CryptoJS from 'crypto-js';
import type { ManagedWallet, VaultConfig, WalletBackupExport, Network, NetworkBalanceData, NFTItem } from '../types';
import { isSolanaWallet } from '../types';

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
// Payload v3 uses domain-separated AES/HMAC keys and authenticates metadata
// and ciphertext. v1/v2 payloads remain readable for one-time migration.
//
// SECURITY CONTRACT (2026-10-08):
//  - v3 stores a domain-separated HMAC verifier, never the PBKDF2 root key;
//    AES and authentication subkeys are derived independently.
//  - Legacy v2 reused its PBKDF2 encryption key as the stored verifier. A
//    successful unlock rekeys and rewrites that vault as v3.
//  - With a PIN active, server sync sends only the authenticated encrypted
//    blob and a one-way verifier; the server does not receive plaintext keys.
//  - persistWallets() no longer strips the PIN: saveWallets() falls back to
//    the session PIN automatically, so every write path stays encrypted.
// ---------------------------------------------------------------------------

let sessionPin: string | null = null;
// Derived key cache: PBKDF2 at 200k iterations costs ~2s, so derive once per
// session and reuse. Memory-only, cleared with the session PIN.
const sessionKeyCache = new Map<string, string>();

/** Remember the PIN for this browser session after unlock / PIN creation. Never persisted. */
export function setSessionPin(pin: string | null): void {
  const normalizedPin = pin && pin.trim().length >= 4 ? pin.trim() : null;
  if (!normalizedPin) {
    clearSessionPin();
    return;
  }
  const salt = getVaultSalt();
  armSessionPin(normalizedPin, salt, deriveKey(normalizedPin, salt));
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

type VaultKeyPurpose = 'verifier' | 'encryption' | 'authentication';

/** Derive independent keys so the stored PIN verifier is never the vault key. */
function deriveSubkey(rootKeyHex: string, purpose: VaultKeyPurpose): string {
  return CryptoJS.HmacSHA256(
    `ton-mass-wallet:v3:${purpose}`,
    CryptoJS.enc.Hex.parse(rootKeyHex)
  ).toString(CryptoJS.enc.Hex);
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

function armSessionPin(pin: string, salt: string, rootKey: string): void {
  sessionPin = pin;
  sessionKeyCache.clear();
  sessionKeyCache.set(salt, rootKey);
}

function verifyPinWithRoot(config: VaultConfig, pin: string): { ok: boolean; salt?: string; rootKey?: string } {
  if (!config.hasPin || !config.pinHash) return { ok: true };
  const input = pin.trim();

  if ((config.pinKdf === 'pbkdf2-sha256-v3' || config.pinKdf === 'pbkdf2-sha256') && config.pinSalt) {
    const rootKey = (sessionPin === input && sessionKeyCache.get(config.pinSalt))
      || deriveKey(input, config.pinSalt);
    const candidate = config.pinKdf === 'pbkdf2-sha256-v3'
      ? deriveSubkey(rootKey, 'verifier')
      : rootKey;
    return { ok: constantTimeEqual(candidate, config.pinHash), salt: config.pinSalt, rootKey };
  }

  const legacy = CryptoJS.SHA256(input).toString();
  return { ok: constantTimeEqual(legacy, config.pinHash) };
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

export interface EncryptedPayloadV3 {
  encrypted: true;
  v: 3;
  kdf: 'pbkdf2-sha256';
  iter: number;
  salt: string;
  data: string;
  mac: string;
  timestamp: number;
}

function v3MacInput(payload: Omit<EncryptedPayloadV3, 'mac'>): string {
  return JSON.stringify({
    encrypted: payload.encrypted,
    v: payload.v,
    kdf: payload.kdf,
    iter: payload.iter,
    salt: payload.salt,
    data: payload.data,
    timestamp: payload.timestamp,
  });
}

function encryptWalletsV3(jsonString: string, pin: string): string {
  const salt = getVaultSalt();
  const cachedRootKey = sessionPin === pin ? getSessionKey(salt) : null;
  const rootKey = cachedRootKey || deriveKey(pin, salt);
  const encryptionKey = deriveSubkey(rootKey, 'encryption');
  const authenticationKey = deriveSubkey(rootKey, 'authentication');
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(jsonString, CryptoJS.enc.Hex.parse(encryptionKey), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const payloadWithoutMac: Omit<EncryptedPayloadV3, 'mac'> = {
    encrypted: true,
    v: 3,
    kdf: 'pbkdf2-sha256',
    iter: PBKDF2_ITER,
    salt,
    data: encrypted.iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    timestamp: Date.now(),
  };
  const mac = CryptoJS.HmacSHA256(v3MacInput(payloadWithoutMac), CryptoJS.enc.Hex.parse(authenticationKey))
    .toString(CryptoJS.enc.Hex);
  return JSON.stringify({ ...payloadWithoutMac, mac } satisfies EncryptedPayloadV3);
}

function decryptWalletsV3(payload: EncryptedPayloadV3, pin: string): string | null {
  try {
    if (
      payload.v !== 3 ||
      payload.kdf !== 'pbkdf2-sha256' ||
      payload.iter !== PBKDF2_ITER ||
      !/^[0-9a-f]{32}$/i.test(payload.salt) ||
      !Number.isFinite(payload.timestamp) ||
      !/^[0-9a-f]{64}$/i.test(payload.mac)
    ) return null;

    const dataMatch = /^([0-9a-f]{32}):([0-9a-f]{32,})$/i.exec(payload.data);
    if (!dataMatch || dataMatch[2].length % 32 !== 0) return null;

    const rootKey = (sessionPin && pin.trim() === sessionPin && sessionKeyCache.get(payload.salt))
      || deriveKey(pin.trim(), payload.salt);
    const authenticationKey = deriveSubkey(rootKey, 'authentication');
    const expectedMac = CryptoJS.HmacSHA256(
      v3MacInput(payload),
      CryptoJS.enc.Hex.parse(authenticationKey)
    ).toString(CryptoJS.enc.Hex);
    if (!constantTimeEqual(expectedMac, payload.mac.toLowerCase())) return null;

    const encryptionKey = deriveSubkey(rootKey, 'encryption');
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Hex.parse(dataMatch[2]) } as any,
      CryptoJS.enc.Hex.parse(encryptionKey),
      { iv: CryptoJS.enc.Hex.parse(dataMatch[1]), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    return decrypted.toString(CryptoJS.enc.Utf8) || null;
  } catch {
    return null;
  }
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

export function isFakeNft(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const id = typeof item.id === 'string' ? item.id : '';
  const name = typeof item.name === 'string' ? item.name : '';
  return (
    id.startsWith('demo_') ||
    id.startsWith('sample_') ||
    id.startsWith('nft_sample_') ||
    name.startsWith('demo_nft')
  );
}

export function filterRealNfts(nfts: any[] | undefined): NFTItem[] {
  if (!Array.isArray(nfts)) return [];
  return nfts.filter(n => !isFakeNft(n));
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
  const defaultNfts = filterRealNfts(w.nfts);

  const rawMainnetNfts = w.networkBalances?.mainnet?.nfts;
  const mainnetNfts = filterRealNfts(Array.isArray(rawMainnetNfts) ? rawMainnetNfts : defaultNfts);
  const testnetNfts = filterRealNfts(w.networkBalances?.testnet?.nfts);

  const mainnetData: NetworkBalanceData = w.networkBalances?.mainnet ? {
    ton: typeof w.networkBalances.mainnet.ton === 'string' ? w.networkBalances.mainnet.ton : (typeof w.balance === 'string' ? w.balance : '0.00'),
    tonNano: typeof w.networkBalances.mainnet.tonNano === 'string' ? w.networkBalances.mainnet.tonNano : (typeof w.balanceNano === 'string' ? w.balanceNano : '0'),
    jettons: Array.isArray(w.networkBalances.mainnet.jettons) ? w.networkBalances.mainnet.jettons : defaultJettons,
    nfts: mainnetNfts,
  } : {
    ton: typeof w.balance === 'string' ? w.balance : '0.00',
    tonNano: typeof w.balanceNano === 'string' ? w.balanceNano : '0',
    jettons: defaultJettons,
    nfts: mainnetNfts,
  };

  const testnetData: NetworkBalanceData = w.networkBalances?.testnet ? {
    ton: typeof w.networkBalances.testnet.ton === 'string' ? w.networkBalances.testnet.ton : '0.00',
    tonNano: typeof w.networkBalances.testnet.tonNano === 'string' ? w.networkBalances.testnet.tonNano : '0',
    jettons: Array.isArray(w.networkBalances.testnet.jettons) ? w.networkBalances.testnet.jettons : [],
    nfts: testnetNfts,
  } : {
    ton: '0.00',
    tonNano: '0',
    jettons: [],
    nfts: testnetNfts,
  };

  // Preserve current balance and NFTs if valid, else fall back to mainnet
  const activeBalance = typeof w.balance === 'string' ? w.balance : mainnetData.ton;
  const activeBalanceNano = typeof w.balanceNano === 'string' ? w.balanceNano : mainnetData.tonNano;
  const activeJettons = Array.isArray(w.jettons) ? w.jettons : (mainnetData.jettons || []);
  const activeNfts = defaultNfts.length > 0 ? defaultNfts : mainnetNfts;

  const detectedChain = w.chain || (isSolanaWallet(w) ? 'solana' : 'ton');

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
        nfts: mainnetNfts,
      },
      testnet: {
        ...testnetData,
        nfts: testnetNfts,
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
    // Fake/demo NFTs must never be persisted into the vault
    const sanitizedWallets = wallets.map(w => ({
      ...w,
      nfts: filterRealNfts(w.nfts),
      networkBalances: w.networkBalances ? {
        mainnet: w.networkBalances.mainnet ? {
          ...w.networkBalances.mainnet,
          nfts: filterRealNfts(w.networkBalances.mainnet.nfts),
        } : undefined as any,
        testnet: w.networkBalances.testnet ? {
          ...w.networkBalances.testnet,
          nfts: filterRealNfts(w.networkBalances.testnet.nfts),
        } : undefined as any,
      } : undefined,
    }));
    const normalized = normalizeWallets(sanitizedWallets);
    const jsonString = JSON.stringify(normalized);

    const effectivePin = pin && pin.trim().length >= 4 ? pin.trim() : sessionPin;

    let payloadToStore: string;
    let isEnc = false;

    if (effectivePin) {
      payloadToStore = encryptWalletsV3(jsonString, effectivePin);
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
      if (isEnc) {
        for (const key of LEGACY_STORAGE_KEYS) {
          if (key !== STORAGE_KEY_WALLETS && key !== STORAGE_KEY_BACKUP_ALT) {
            localStorage.removeItem(key);
          }
        }
      }
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
   * Handles: authenticated v3 payloads, legacy v2/v1 payloads, plaintext arrays.
   */
  public static parseStoredData(item: string, pin?: string, configOverride?: VaultConfig): { wallets: ManagedWallet[]; isEncrypted: boolean; error?: string } {
    try {
      const parsed = JSON.parse(item);
      const expectedConfig = configOverride || this.getVaultConfig();
      const parsePlainWallets = (wallets: any[]) => {
        if (!expectedConfig.hasPin) return { wallets: normalizeWallets(wallets), isEncrypted: false };
        if (!pin) return { wallets: [], isEncrypted: true };
        if (expectedConfig.pinKdf === 'pbkdf2-sha256-v3') {
          return { wallets: [], isEncrypted: true, error: 'Vault format downgrade rejected. Restore a valid authenticated vault copy.' };
        }
        if (!verifyPinWithRoot(expectedConfig, pin).ok) {
          return { wallets: [], isEncrypted: true, error: 'Incorrect PIN code' };
        }
        // Legacy plaintext is released only after passphrase verification and
        // remains marked encrypted so the unlock flow immediately migrates it.
        return { wallets: normalizeWallets(wallets), isEncrypted: true };
      };

      // Raw array
      if (Array.isArray(parsed)) {
        return parsePlainWallets(parsed);
      }

      // Object with .wallets array
      if (Array.isArray(parsed.wallets)) {
        return parsePlainWallets(parsed.wallets);
      }

      // Encrypted payload (v2 PBKDF2 or legacy v1)
      if (parsed.encrypted) {
        if (!pin) {
          return { wallets: [], isEncrypted: true };
        }
        if (parsed.v === 3) {
          if (!parsed.salt || !parsed.data || !parsed.mac) {
            return { wallets: [], isEncrypted: true, error: 'Invalid or incomplete authenticated vault payload.' };
          }
          const decryptedStr = decryptWalletsV3(parsed as EncryptedPayloadV3, pin.trim());
          if (decryptedStr) {
            const rawWallets = JSON.parse(decryptedStr);
            const list = Array.isArray(rawWallets) ? rawWallets : (rawWallets.wallets || []);
            return { wallets: normalizeWallets(list), isEncrypted: true };
          }
          return { wallets: [], isEncrypted: true, error: 'Vault authentication failed or the passphrase is incorrect.' };
        }
        if (expectedConfig.pinKdf === 'pbkdf2-sha256-v3') {
          return { wallets: [], isEncrypted: true, error: 'Vault format downgrade rejected. Restore a valid authenticated vault copy.' };
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
        return parsePlainWallets(extracted);
      }

      return { wallets: [], isEncrypted: !!expectedConfig.hasPin };
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

      return { wallets: [], isEncrypted: !!this.getVaultConfig().hasPin };
    } catch (e) {
      console.error('Failed to load wallets from storage:', e);
      return { wallets: [], isEncrypted: false, error: 'Corrupt storage data' };
    }
  }

  /**
   * Comprehensive async loader: Checks Backend API -> IndexedDB -> LocalStorage
   * Authoritative backend API (/api/wallets) is checked first when running with local server.
   */
  public static async loadAllWalletsAsync(pin?: string): Promise<{ wallets: ManagedWallet[]; isEncrypted: boolean; config: VaultConfig; error?: string }> {
    const config = this.getVaultConfig();

    // 1. Try Backend API (/api/wallets) first if available
    try {
      const resp = await fetch('/api/wallets');
      if (resp.ok) {
        const json = await resp.json();
        const serverConfig: VaultConfig = json.vaultConfig || config;
        const acceptedConfig = config.pinKdf === 'pbkdf2-sha256-v3' && serverConfig.pinKdf !== 'pbkdf2-sha256-v3'
          ? config
          : serverConfig;

        if (json && json.encrypted === true && typeof json.payload === 'string') {
          if (pin) {
            const parsed = this.parseStoredData(json.payload, pin, acceptedConfig);
            if (parsed.error) {
              // Do not let a damaged server copy replace a usable local backup.
              const idbData: any = await idbGet('wallets_payload');
              if (idbData?.encrypted) {
                const idbRes = this.parseStoredData(idbData.raw, pin);
                if (idbRes.isEncrypted && !idbRes.error) return { wallets: idbRes.wallets, isEncrypted: true, config };
              }
              const localRes = this.loadWallets(pin);
              if (localRes.isEncrypted && !localRes.error) return { wallets: localRes.wallets, isEncrypted: true, config };
              return { wallets: [], isEncrypted: true, config: acceptedConfig, error: parsed.error };
            }
            if (parsed.isEncrypted) {
              try {
                localStorage.setItem(STORAGE_KEY_WALLETS, json.payload);
                localStorage.setItem(STORAGE_KEY_BACKUP_ALT, json.payload);
                localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(acceptedConfig));
              } catch { /* quota — IndexedDB still primary */ }
              await idbSet('wallets_payload', { encrypted: true, raw: json.payload, wallets: [], timestamp: Date.now() });
              return { wallets: parsed.wallets, isEncrypted: true, config: acceptedConfig };
            }
            return { wallets: [], isEncrypted: true, config: acceptedConfig, error: 'Server vault payload is not a valid encrypted vault.' };
          }

          // On a locked startup, only seed absent caches; preserve any existing
          // backup until the server payload can be authenticated on unlock.
          try {
            if (!localStorage.getItem(STORAGE_KEY_WALLETS)) {
              localStorage.setItem(STORAGE_KEY_WALLETS, json.payload);
              localStorage.setItem(STORAGE_KEY_BACKUP_ALT, json.payload);
              await idbSet('wallets_payload', { encrypted: true, raw: json.payload, wallets: [], timestamp: Date.now() });
            }
            if (!config.hasPin) localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(acceptedConfig));
          } catch { /* quota — server copy remains authoritative */ }

          return { wallets: [], isEncrypted: true, config: config.hasPin ? config : acceptedConfig };
        }

        if (json && Array.isArray(json.wallets) && json.wallets.length > 0) {
          // A v3 vault must never fall back to a plaintext server response.
          // Ignore it and prefer authenticated local backups instead.
          if (config.pinKdf === 'pbkdf2-sha256-v3') {
            // Continue to IndexedDB and LocalStorage below.
          } else {
          const normalized = normalizeWallets(json.wallets);
          const protectionConfig = serverConfig.hasPin ? serverConfig : config;
          if (protectionConfig.hasPin) {
            if (!config.hasPin && serverConfig.hasPin) {
              try { localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(serverConfig)); } catch { /* handled as locked below */ }
            }
            const effectiveConfig = config.hasPin ? config : serverConfig;
            if (!pin) {
              return { wallets: [], isEncrypted: true, config: effectiveConfig };
            }
            if (protectionConfig.pinKdf === 'pbkdf2-sha256-v3') {
              return { wallets: [], isEncrypted: true, config: effectiveConfig, error: 'Vault format downgrade rejected. Restore a valid authenticated vault copy.' };
            }
            if (!verifyPinWithRoot(effectiveConfig, pin).ok) {
              return { wallets: [], isEncrypted: true, config: effectiveConfig, error: 'Incorrect PIN code' };
            }
            // Legacy local-server data may still be plaintext. Release it only
            // after PIN verification and mark it for immediate v3 migration.
            return { wallets: normalized, isEncrypted: true, config: effectiveConfig };
          }

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
            if (!parsed.error && parsed.isEncrypted) return { wallets: parsed.wallets, isEncrypted: true, config };
          } else {
            return { wallets: [], isEncrypted: true, config };
          }
        } else if (Array.isArray(idbData.wallets) && idbData.wallets.length > 0) {
          const normalized = normalizeWallets(idbData.wallets);
          if (config.hasPin) {
            if (!pin) return { wallets: [], isEncrypted: true, config };
            if (config.pinKdf !== 'pbkdf2-sha256-v3' && verifyPinWithRoot(config, pin).ok) {
              return { wallets: normalized, isEncrypted: true, config };
            }
            // Invalid, stale, or downgraded IndexedDB data must not hide a
            // usable LocalStorage backup; the latter remains lock-gated too.
          } else {
            return { wallets: normalized, isEncrypted: false, config };
          }
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
      return { wallets: localRes.wallets, isEncrypted: localRes.isEncrypted, config, error: localRes.error };
    }

    return { wallets: [], isEncrypted: !!config.hasPin, config };
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
    clearSessionPin();
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
   * Stores a domain-separated one-way verifier — never the PIN or encryption
   * key. Also arms the session PIN so subsequent saves stay
   * encrypted without re-prompting.
   */
  public static setVaultPin(wallets: ManagedWallet[], newPin: string): void {
    const pin = newPin.trim();
    if (pin.length < 12 || pin.length > 32) {
      throw new Error('Vault passphrases must be between 12 and 32 characters.');
    }
    const salt = newSalt();
    const rootKey = deriveKey(pin, salt);
    const verifier = deriveSubkey(rootKey, 'verifier');
    const config: VaultConfig = {
      isLocked: false,
      hasPin: true,
      pinHash: verifier,
      pinSalt: salt,
      pinKdf: 'pbkdf2-sha256-v3',
      lastBackupAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(config));
    armSessionPin(pin, salt, rootKey);
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
    return verifyPinWithRoot(this.getVaultConfig(), pin).ok;
  }

  /**
   * Verify the PIN and, on success, arm the session (PIN + derived key cached).
   * Use this for unlock flows so subsequent decrypt/encrypt calls don't
   * re-run PBKDF2.
   */
  public static verifyAndUnlock(pin: string): boolean {
    const normalizedPin = pin.trim();
    const verification = verifyPinWithRoot(this.getVaultConfig(), normalizedPin);
    if (!verification.ok) return false;
    if (verification.salt && verification.rootKey) {
      armSessionPin(normalizedPin, verification.salt, verification.rootKey);
    } else {
      setSessionPin(normalizedPin);
    }
    return true;
  }

  /** Upgrade a successfully unlocked legacy vault and replace old plaintext caches. */
  public static migrateVaultEncryption(wallets: ManagedWallet[], pin: string): void {
    const normalizedPin = pin.trim();
    const config = this.getVaultConfig();
    const hasVerifiedSessionRoot = sessionPin === normalizedPin && !!config.pinSalt && sessionKeyCache.has(config.pinSalt);
    const verification = hasVerifiedSessionRoot ? undefined : verifyPinWithRoot(config, normalizedPin);
    if (!config.hasPin || (verification && !verification.ok)) {
      throw new Error('Vault passphrase verification failed; migration was not applied.');
    }

    if (config.pinKdf !== 'pbkdf2-sha256-v3' || !config.pinSalt) {
      const salt = newSalt();
      const rootKey = deriveKey(normalizedPin, salt);
      const upgradedConfig: VaultConfig = {
        ...config,
        isLocked: false,
        hasPin: true,
        pinHash: deriveSubkey(rootKey, 'verifier'),
        pinSalt: salt,
        pinKdf: 'pbkdf2-sha256-v3',
      };
      localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(upgradedConfig));
      armSessionPin(normalizedPin, salt, rootKey);
    } else if (!hasVerifiedSessionRoot && verification?.salt && verification.rootKey) {
      armSessionPin(normalizedPin, verification.salt, verification.rootKey);
    }

    this.saveWallets(wallets, normalizedPin);
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
   * Export Managed Wallets to CSV with CSV-injection (formula/DDE) protection.
   */
  public static exportToCSV(wallets: ManagedWallet[], filename: string = `wallets_${Date.now()}.csv`): void {
    const escapeCsv = (val: string | number): string => {
      const str = String(val ?? '');
      // Prevent formula injection in spreadsheet software (Excel, LibreOffice)
      const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      return `"${sanitized.replace(/"/g, '""')}"`;
    };

    const headers = ['Index', 'Chain', 'Label', 'Tag', 'Address', 'Version', 'Private Key (Base58)', 'Squads v4 Vault', 'Keyphrase', 'Public Key', 'Created At'];
    const rows = wallets.map((w, idx) => [
      idx + 1,
      escapeCsv(w.chain || 'ton'),
      escapeCsv(w.label),
      escapeCsv(w.tag),
      escapeCsv(w.address),
      escapeCsv(w.version),
      escapeCsv(w.privateKey || ''),
      escapeCsv(w.squadsVaultAddress || ''),
      escapeCsv(Array.isArray(w.mnemonic) ? w.mnemonic.join(' ') : ''),
      escapeCsv(w.publicKey),
      escapeCsv(new Date(w.createdAt).toLocaleString()),
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
