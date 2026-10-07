import React, { useState } from 'react';
import type { VaultConfig, ManagedWallet } from '../types';
import { StorageService } from '../services/storageService';
import { X, Lock, Unlock, ShieldCheck } from 'lucide-react';

interface VaultSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultConfig: VaultConfig;
  wallets: ManagedWallet[];
  onVaultConfigUpdated: () => void;
}

export const VaultSecurityModal: React.FC<VaultSecurityModalProps> = ({
  isOpen,
  onClose,
  vaultConfig,
  wallets,
  onVaultConfigUpdated,
}) => {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSetPin = () => {
    if (pin.length < 4) {
      setError('Passphrase must be at least 4 characters');
      return;
    }
    if (pin !== confirmPin) {
      setError('Entries do not match');
      return;
    }

    StorageService.setVaultPin(wallets, pin);
    onVaultConfigUpdated();
    setPin('');
    setConfirmPin('');
    onClose();
  };

  const handleRemovePin = () => {
    if (confirm('Are you sure you want to remove PIN encryption from local storage?')) {
      StorageService.removeVaultPin(wallets);
      onVaultConfigUpdated();
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Vault Security & PIN</h2>
              <p className="text-xs text-gray-400">PBKDF2 + AES-256 encryption for the whole vault</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          
          {vaultConfig.hasPin ? (
            /* PIN active screen */
            <div className="space-y-4 text-center">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-left">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">Vault Protected with PIN</h4>
                  <p className="text-xs text-emerald-300/80">
                    Seed phrases and private keys are encrypted with PBKDF2 + AES-256 — in the browser
                    and in the local vault file. The server only ever stores the encrypted blob.
                  </p>
                </div>
              </div>

              <button
                onClick={handleRemovePin}
                className="w-full btn btn-danger py-3 text-xs font-bold"
              >
                <Unlock className="w-4 h-4" />
                Remove PIN Protection
              </button>
            </div>
          ) : (
            /* Set PIN screen */
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                Set a master passphrase to encrypt all wallets and seed phrases — in the browser
                <em>and</em> in the local server vault file. Minimum 4 characters; 12+ recommended.
                Longer is stronger: this uses PBKDF2-SHA256 with 200,000 iterations.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Enter New Passphrase:</label>
                <input
                  type="password"
                  maxLength={32}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError(null);
                  }}
                  placeholder="4–32 characters"
                  className="input-field text-center font-mono text-base tracking-widest py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Confirm Passphrase:</label>
                <input
                  type="password"
                  maxLength={32}
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value);
                    setError(null);
                  }}
                  placeholder="Re-enter passphrase"
                  className="input-field text-center font-mono text-base tracking-widest py-2"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 font-semibold text-center">{error}</p>
              )}

              <button
                onClick={handleSetPin}
                disabled={!pin || !confirmPin}
                className="w-full btn btn-primary py-3 text-xs font-bold shadow-lg shadow-[#0098EA]/30"
              >
                <Lock className="w-4 h-4" />
                Enable Master PIN Encryption
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
