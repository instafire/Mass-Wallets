import React, { useState, useEffect } from 'react';
import type { ManagedWallet, VaultConfig } from '../types';
import { StorageService } from '../services/storageService';
import { X, Key, Copy, Check, ShieldAlert, Lock, Eye, EyeOff, ShieldCheck, FileCode } from 'lucide-react';

interface MnemonicRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: ManagedWallet | null;
  vaultConfig: VaultConfig;
}

export const MnemonicRevealModal: React.FC<MnemonicRevealModalProps> = ({
  isOpen,
  onClose,
  wallet,
  vaultConfig,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(!vaultConfig.hasPin);
  const [pinError, setPinError] = useState<boolean>(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState<boolean>(false);
  const [copiedPrivateKey, setCopiedPrivateKey] = useState<boolean>(false);
  const [copiedSquadsVault, setCopiedSquadsVault] = useState<boolean>(false);
  const [revealPrivateKey, setRevealPrivateKey] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsUnlocked(!vaultConfig.hasPin);
      setPinInput('');
      setPinError(false);
      setCopiedMnemonic(false);
      setCopiedPrivateKey(false);
      setCopiedSquadsVault(false);
      setRevealPrivateKey(false);
    }
  }, [isOpen, wallet?.id, vaultConfig.hasPin]);

  if (!isOpen || !wallet) return null;

  const isSolana = wallet.chain === 'solana' || wallet.version === 'solana-ed25519' || wallet.version === 'squads-v4' || !!wallet.privateKey;

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (StorageService.verifyPin(pinInput)) {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleCopyMnemonic = () => {
    const mnemonicStr = (wallet.mnemonic || []).join(' ');
    navigator.clipboard.writeText(mnemonicStr);
    setCopiedMnemonic(true);
    setTimeout(() => setCopiedMnemonic(false), 2000);
  };

  const handleCopyPrivateKey = () => {
    if (wallet.privateKey) {
      navigator.clipboard.writeText(wallet.privateKey);
      setCopiedPrivateKey(true);
      setTimeout(() => setCopiedPrivateKey(false), 2000);
    }
  };

  const handleCopySquadsVault = () => {
    if (wallet.squadsVaultAddress) {
      navigator.clipboard.writeText(wallet.squadsVaultAddress);
      setCopiedSquadsVault(true);
      setTimeout(() => setCopiedSquadsVault(false), 2000);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-xl max-h-[90vh] overflow-y-auto p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSolana ? 'bg-[#9945FF]/20 text-[#14F195]' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Private Key & Security Credentials</h2>
                {isSolana && (
                  <span className="badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30 text-[10px] font-mono">
                    SOLANA
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{wallet.label} ({wallet.version})</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setIsUnlocked(!vaultConfig.hasPin);
              setPinInput('');
              onClose();
            }}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-5 space-y-4">
          
          {vaultConfig.hasPin && !isUnlocked ? (
            /* PIN Protection Screen */
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Enter Master Security PIN</h3>
                <p className="text-xs text-gray-400">Unlock to reveal private key and recovery phrase</p>
              </div>

              <form onSubmit={handleUnlock} className="max-w-xs mx-auto space-y-2">
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="Enter 4-6 digit PIN"
                  className="input-field text-center font-mono text-lg tracking-widest"
                />
                {pinError && (
                  <p className="text-xs text-red-400 font-semibold">Incorrect PIN code</p>
                )}
                <button
                  type="submit"
                  disabled={!pinInput}
                  className="w-full btn btn-primary py-2.5 text-xs font-bold"
                >
                  Unlock Credentials
                </button>
              </form>
            </div>
          ) : (
            /* Credentials View */
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center gap-3 text-xs text-amber-300">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Never share your private key or seed phrase! Anyone with these credentials can take complete control of your funds.
                </span>
              </div>

              {/* Solana Base58 Private Key Section */}
              {wallet.privateKey && (
                <div className="bg-[#080d1a] border border-[#9945FF]/30 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-[#14F195]" />
                      <span className="text-xs font-bold text-white">Solana Private Key (Base58)</span>
                      <span className="badge bg-[#14F195]/10 text-[#14F195] text-[10px]">
                        Phantom / Solflare Compatible
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevealPrivateKey(!revealPrivateKey)}
                      className="btn btn-secondary btn-sm py-1 px-2 text-xs text-gray-300 hover:text-white flex items-center gap-1"
                    >
                      {revealPrivateKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{revealPrivateKey ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>

                  <div className="bg-[#050811] p-3 rounded-lg border border-white/5 font-mono text-xs break-all text-gray-200 select-all">
                    {revealPrivateKey ? wallet.privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPrivateKey}
                    className="w-full btn bg-gradient-to-r from-[#9945FF]/80 to-[#14F195]/80 hover:opacity-90 text-white py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#9945FF]/20"
                  >
                    {copiedPrivateKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPrivateKey ? 'Private Key Copied to Clipboard!' : 'Copy Base58 Private Key'}</span>
                  </button>
                </div>
              )}

              {/* Squads Protocol v4 Vault PDA Section */}
              {wallet.squadsVaultAddress && (
                <div className="bg-[#080d1a] border border-[#14F195]/30 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#14F195]" />
                      <span className="text-xs font-bold text-white">Squads Protocol v4 Vault PDA</span>
                      <span className="badge bg-[#9945FF]/20 text-[#14F195] text-[10px]">
                        Squads Smart Account
                      </span>
                    </div>
                  </div>
                  <div className="bg-[#050811] p-2.5 rounded-lg border border-white/5 font-mono text-xs break-all text-[#14F195] select-all">
                    {wallet.squadsVaultAddress}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Authority Public Key: <span className="font-mono text-gray-300">{wallet.publicKey}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySquadsVault}
                    className="w-full btn btn-secondary py-2 text-xs font-bold flex items-center justify-center gap-2 text-[#14F195] border border-[#14F195]/30 hover:bg-[#14F195]/10"
                  >
                    {copiedSquadsVault ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSquadsVault ? 'Squads Vault PDA Copied!' : 'Copy Squads v4 Vault Address'}</span>
                  </button>
                </div>
              )}

              {/* Mnemonic Seed Phrase Grid */}
              {wallet.mnemonic && wallet.mnemonic.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-amber-400" />
                      <span>{wallet.mnemonic.length}-Word Seed Phrase</span>
                    </span>
                    <span className="text-xs text-gray-400 font-mono">BIP39 Mnemonic</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-[#080d1a] p-4 rounded-xl border border-white/10 max-h-56 overflow-y-auto">
                    {wallet.mnemonic.map((word, idx) => (
                      <div key={idx} className="bg-[#121b30] p-2 rounded-lg border border-white/5 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-gray-500 w-4 select-none">{idx + 1}.</span>
                        <span className="font-mono text-xs font-bold text-white truncate">{word}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleCopyMnemonic}
                    className="w-full btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {copiedMnemonic ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedMnemonic ? 'Seed Phrase Copied!' : `Copy All ${wallet.mnemonic.length} Words`}</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
