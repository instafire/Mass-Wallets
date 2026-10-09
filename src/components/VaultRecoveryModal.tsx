import React, { useState, useEffect } from 'react';
import type { ManagedWallet, VaultConfig, Network } from '../types';
import { StorageService } from '../services/storageService';
import { 
  X, 
  ShieldCheck, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Search, 
  FileText, 
  FileCode,
  Lock
} from 'lucide-react';

interface VaultRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  vaultConfig: VaultConfig;
  network: Network;
}

export const VaultRecoveryModal: React.FC<VaultRecoveryModalProps> = ({
  isOpen,
  onClose,
  wallets,
  vaultConfig,
  network,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAllWords, setShowAllWords] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(!vaultConfig.hasPin);
  const [pinError, setPinError] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsUnlocked(!vaultConfig.hasPin);
      setPinInput('');
      setPinError(false);
      setCopiedAll(false);
    }
  }, [isOpen, vaultConfig.hasPin]);

  if (!isOpen) return null;

  const filteredWallets = wallets.filter(w => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const tagStr = (w.tag || '').toLowerCase();
    const mnemonicStr = (w.mnemonic || []).join(' ').toLowerCase();
    return (
      (w.label || '').toLowerCase().includes(term) ||
      (w.address || '').toLowerCase().includes(term) ||
      tagStr.includes(term) ||
      mnemonicStr.includes(term)
    );
  });

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (StorageService.verifyPin(pinInput)) {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleCopyPair = (wallet: ManagedWallet) => {
    const pair = `Label: ${wallet.label}\nAddress: ${wallet.address}\nKeyphrase: ${(wallet.mnemonic || []).join(' ')}\nPublic Key: ${wallet.publicKey}`;
    navigator.clipboard.writeText(pair);
    setCopiedId(wallet.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllPairs = () => {
    const all = wallets.map((w, idx) => 
      `#${idx + 1} | ${w.label} (${w.version})\nAddress: ${w.address}\nKeyphrase: ${(w.mnemonic || []).join(' ')}\n`
    ).join('\n');
    navigator.clipboard.writeText(all);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-4xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Vault Recovery & Keyphrase Center</h2>
                <span className="badge badge-success">Data Auto-Saved</span>
              </div>
              <p className="text-xs text-gray-400">
                All 24-word seed phrases are stored safely in local storage and match derived addresses.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-5 space-y-4">
          
          {vaultConfig.hasPin && !isUnlocked ? (
            /* PIN Protection Screen */
            <div className="text-center py-10 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Security Unlock Required</h3>
                <p className="text-xs text-gray-400">Enter your master PIN to view all keyphrase recovery data</p>
              </div>

              <form onSubmit={handleUnlock} className="max-w-xs mx-auto space-y-2">
                <input
                  type="password"
                  maxLength={32}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="Enter PIN"
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
                  Unlock Recovery Center
                </button>
              </form>
            </div>
          ) : (
            /* Keyphrases & Addresses Table */
            <div className="space-y-4">
              
              {/* Controls & Export Bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#080d1a] p-3 rounded-xl border border-white/10">
                
                {/* Search */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search address or phrase..."
                    className="input-field pl-9 py-1.5 text-xs"
                  />
                </div>

                {/* Show/Hide & Copy All */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => setShowAllWords(!showAllWords)}
                    className="btn btn-secondary btn-sm"
                  >
                    {showAllWords ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-[#0098EA]" />}
                    {showAllWords ? 'Hide Phrases' : 'Reveal All Phrases'}
                  </button>

                  <button
                    onClick={handleCopyAllPairs}
                    className="btn btn-secondary btn-sm"
                  >
                    {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedAll ? 'All Copied!' : 'Copy All Pairs'}
                  </button>

                  {/* Export Options */}
                  <button
                    onClick={() => StorageService.exportFullMasterBackup(wallets, network)}
                    className="btn btn-primary btn-sm"
                    title="Download Full Vault Master Backup (JSON)"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    Master JSON
                  </button>

                  <button
                    onClick={() => StorageService.exportPairsTXT(wallets)}
                    className="btn btn-secondary btn-sm"
                    title="Download Readable Recovery File (TXT)"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Recovery TXT
                  </button>
                </div>

              </div>

              {/* Recovery List Table */}
              <div className="max-h-96 overflow-y-auto border border-white/10 rounded-xl bg-[#080d1a] divide-y divide-white/5">
                {filteredWallets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    No matching wallets found in vault.
                  </div>
                ) : (
                  filteredWallets.map((wallet, idx) => (
                    <div key={wallet.id} className="p-3.5 space-y-2 hover:bg-white/5 transition-all text-xs">
                      
                      {/* Top Row: Label, Version badge, Address */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 font-bold w-5">#{idx + 1}</span>
                          <span className="font-bold text-white text-sm">{wallet.label}</span>
                          <span className="badge badge-primary">{wallet.version}</span>
                          {wallet.tag && (
                            <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                              {wallet.tag}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleCopyPair(wallet)}
                          className="btn btn-secondary btn-sm py-1 px-2.5 text-[11px]"
                          title="Copy Address & Keyphrase Pair"
                        >
                          {copiedId === wallet.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === wallet.id ? 'Copied Pair' : 'Copy Pair'}
                        </button>
                      </div>

                      {/* TON Address */}
                      <div className="bg-[#121b30] p-2 rounded-lg font-mono text-[11px] text-gray-300 break-all flex items-center justify-between">
                        <span><strong className="text-gray-400 font-semibold mr-1">Address:</strong> {wallet.address}</span>
                      </div>

                      {/* Keyphrase Words */}
                      <div className="bg-[#0e1526] p-2.5 rounded-lg border border-white/5">
                        <span className="text-gray-400 font-semibold block mb-1">Keyphrase (24 Words):</span>
                        {showAllWords ? (
                          <p className="font-mono text-amber-300/90 text-xs font-semibold leading-relaxed tracking-wide">
                            {(wallet.mnemonic || []).join(' ')}
                          </p>
                        ) : (
                          <p className="font-mono text-gray-500 text-xs italic tracking-widest">
                            •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• ••••••••
                          </p>
                        )}
                      </div>

                    </div>
                  ))
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
