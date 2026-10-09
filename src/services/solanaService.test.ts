import assert from 'node:assert/strict';
import test from 'node:test';
import { SolanaService } from './solanaService';

test('rejects a 12-word phrase with an invalid BIP-39 checksum', async () => {
  const invalidMnemonic = Array(12).fill('abandon').join(' ');
  await assert.rejects(
    () => SolanaService.importWalletFromMnemonic(invalidMnemonic, 'solana-ed25519'),
    /checksum\/wordlist validation failed/
  );
});
