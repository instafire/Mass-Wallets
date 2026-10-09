import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import CryptoJS from 'crypto-js';
import { clearSessionPin, StorageService } from './storageService';

const storage = new Map<string, string>();
const storageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;

beforeEach(() => {
  storage.clear();
  clearSessionPin();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storageMock });
  globalThis.fetch = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
  console.warn = () => {};
});

afterEach(() => {
  clearSessionPin();
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
});

function deriveLegacyKey(pin: string, salt: string): string {
  return CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), {
    keySize: 256 / 32,
    iterations: 200000,
    hasher: CryptoJS.algo.SHA256,
  }).toString(CryptoJS.enc.Hex);
}

test('v3 stores a verifier distinct from the root key and rejects tampering and downgrade attempts', async () => {
  const pin = 'a strong test passphrase';
  StorageService.setVaultPin([], pin);

  const config = StorageService.getVaultConfig();
  const payloadText = storage.get('tonkeeper_mass_wallets_v2');
  assert.ok(payloadText);
  const payload = JSON.parse(payloadText);
  assert.equal(config.pinKdf, 'pbkdf2-sha256-v3');
  assert.equal(payload.v, 3);
  assert.match(payload.mac, /^[0-9a-f]{64}$/);
  assert.notEqual(config.pinHash, deriveLegacyKey(pin, config.pinSalt!));
  assert.equal(StorageService.verifyPin(pin), true);
  assert.equal(StorageService.verifyPin('wrong passphrase'), false);

  const restored = StorageService.parseStoredData(payloadText, pin);
  assert.equal(restored.isEncrypted, true);
  assert.equal(restored.error, undefined);
  assert.deepEqual(restored.wallets, []);

  const tampered = { ...payload, data: payload.data.slice(0, -1) + (payload.data.endsWith('0') ? '1' : '0') };
  const rejected = StorageService.parseStoredData(JSON.stringify(tampered), pin);
  assert.equal(rejected.wallets.length, 0);
  assert.match(rejected.error || '', /authentication failed/);

  const incomplete = { ...payload };
  delete incomplete.mac;
  assert.match(StorageService.parseStoredData(JSON.stringify(incomplete), pin).error || '', /incomplete authenticated/);
  const legacyPlaintext = JSON.stringify([{ address: 'untrusted-plaintext' }]);
  assert.equal(StorageService.parseStoredData(legacyPlaintext).wallets.length, 0);
  assert.match(StorageService.parseStoredData(legacyPlaintext, pin).error || '', /downgrade rejected/);

  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      wallets: [{ address: 'untrusted-server-plaintext' }],
      vaultConfig: { ...config, pinKdf: 'pbkdf2-sha256' },
    }),
  })) as unknown as typeof fetch;
  const rollback = await StorageService.loadAllWalletsAsync(pin);
  assert.equal(rollback.isEncrypted, true);
  assert.equal(rollback.config.pinKdf, 'pbkdf2-sha256-v3');
  assert.deepEqual(rollback.wallets, []);
});

test('requires at least 12 characters for a new vault passphrase', () => {
  assert.throws(() => StorageService.setVaultPin([], '123456'), /between 12 and 32 characters/);
});

test('unlock migration separates the legacy verifier and removes deprecated plaintext browser copies', async () => {
  const pin = 'legacy test passphrase';
  const salt = '00112233445566778899aabbccddeeff';
  const legacyKey = deriveLegacyKey(pin, salt);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt('[]', CryptoJS.enc.Hex.parse(legacyKey), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const legacyPayload = JSON.stringify({
    encrypted: true,
    v: 2,
    kdf: 'pbkdf2-sha256',
    iter: 200000,
    salt,
    data: `${iv.toString(CryptoJS.enc.Hex)}:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`,
    timestamp: Date.now(),
  });

  storage.set('tonkeeper_vault_config_v2', JSON.stringify({
    isLocked: false,
    hasPin: true,
    pinHash: legacyKey,
    pinSalt: salt,
    pinKdf: 'pbkdf2-sha256',
  }));
  storage.set('tonkeeper_mass_wallets_v2', legacyPayload);
  storage.set('tongram_wallets', JSON.stringify([{ address: 'legacy-plaintext-copy' }]));

  assert.equal(StorageService.verifyAndUnlock(pin), true);
  const legacyPlaintext = StorageService.parseStoredData(JSON.stringify([{ address: 'legacy-copy' }]), pin);
  assert.equal(legacyPlaintext.isEncrypted, true);
  assert.equal(legacyPlaintext.wallets.length, 1);
  const loaded = await StorageService.loadAllWalletsAsync(pin);
  assert.equal(loaded.isEncrypted, true);
  assert.equal(loaded.error, undefined);
  assert.deepEqual(loaded.wallets, []);

  StorageService.migrateVaultEncryption(loaded.wallets, pin);
  const upgradedConfig = StorageService.getVaultConfig();
  const upgradedPayload = JSON.parse(storage.get('tonkeeper_mass_wallets_v2')!);
  assert.equal(upgradedConfig.pinKdf, 'pbkdf2-sha256-v3');
  assert.notEqual(upgradedConfig.pinHash, legacyKey);
  assert.equal(upgradedPayload.v, 3);
  assert.equal(storage.has('tongram_wallets'), false);
});
