import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert } from 'lucide-react';
import { clearSessionPin, StorageService } from '../services/storageService';
import type { ManagedWallet } from '../types';

interface UnlockVaultModalProps {
  isOpen: boolean;
  onUnlocked: (wallets: ManagedWallet[]) => void;
}

export const UnlockVaultModal: React.FC<UnlockVaultModalProps> = ({ isOpen, onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter your PIN');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const ok = StorageService.verifyAndUnlock(pin.trim());
      if (ok) {
        const res = await StorageService.loadAllWalletsAsync(pin.trim());
        if (res.error) {
          clearSessionPin();
          setError(res.error);
          return;
        }
        if (!res.isEncrypted) {
          clearSessionPin();
          setError('Encrypted vault data was not found. No data was changed.');
          return;
        }
        StorageService.migrateVaultEncryption(res.wallets, pin.trim());
        onUnlocked(res.wallets || []);
        setPin('');
        return;
      } else {
        setError('Incorrect PIN. Please try again.');
      }
    } catch (err) {
      clearSessionPin();
      setError(err instanceof Error ? err.message : 'Decryption failed. Please check your passphrase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="glass-card max-w-md w-full p-8 border border-white/20 shadow-2xl relative animate-fadeIn text-center space-y-6">
        
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30 shadow-lg shadow-amber-500/15">
          <Lock className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Unlock Your Vault</h2>
          <p className="text-xs text-gray-400 mt-1.5">
            Your wallets and recovery phrases are protected with authenticated AES-256 passphrase encryption.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 text-left">
              Enter Master Passphrase:
            </label>
            <input
              type="password"
              autoFocus
              maxLength={32}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              placeholder="••••"
              className="input-field text-center font-mono text-xl tracking-widest py-3"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2 text-left">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !pin}
            className="w-full btn btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#0098EA]/30"
          >
            <KeyRound className="w-4 h-4" />
            <span>{isSubmitting ? 'Decrypting Vault...' : 'Unlock Vault Wallets'}</span>
          </button>
        </form>

      </div>
    </div>
  );
};
