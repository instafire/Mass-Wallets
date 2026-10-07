import React, { useState } from 'react';
import type { ManagedWallet, Network } from '../types';
import { isSolanaWallet } from '../types';
import { PriceService } from '../services/priceService';
import { 
  X, 
  Crown, 
  Search, 
  Check, 
  Coins
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SwitchTreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  currentTreasuryId?: string;
  network?: Network;
  onSelectTreasury: (walletId: string) => void;
}

export const SwitchTreasuryModal: React.FC<SwitchTreasuryModalProps> = ({
  isOpen,
  onClose,
  wallets,
  currentTreasuryId,
  onSelectTreasury,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [chainFilter, setChainFilter] = useState<'all' | 'ton' | 'solana'>('all');

  if (!isOpen) return null;

  const filteredWallets = wallets.filter(w => {
    const isSol = isSolanaWallet(w);
    if (chainFilter === 'ton' && isSol) return false;
    if (chainFilter === 'solana' && !isSol) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchLabel = w.label.toLowerCase().includes(q);
      const matchAddress = w.address.toLowerCase().includes(q);
      const matchTag = (w.tag || '').toLowerCase().includes(q);
      if (!matchLabel && !matchAddress && !matchTag) return false;
    }
    return true;
  });

  const handleSwitch = (wallet: ManagedWallet) => {
    if (wallet.id === currentTreasuryId) {
      onClose();
      return;
    }
    onSelectTreasury(wallet.id);
    confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 } });
    onClose();
  };

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-2xl p-6 relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-black flex items-center justify-center font-extrabold shadow-lg shadow-amber-500/20">
              <Crown className="w-5 h-5 text-[#070a14]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Switch Master Treasury Wallet</span>
              </h2>
              <p className="text-xs text-gray-400">
                Designate any wallet as the central funding treasury for distributions and sweeping
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

        {/* Filter & Search Bar */}
        <div className="py-3 shrink-0 flex flex-col sm:flex-row gap-2 border-b border-white/5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by wallet label, address, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 py-2 text-xs w-full"
            />
          </div>

          <div className="flex bg-[#070a14] p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setChainFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                chainFilter === 'all' ? 'bg-[#0098EA] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              All Chains
            </button>
            <button
              onClick={() => setChainFilter('ton')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                chainFilter === 'ton' ? 'bg-[#0098EA] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              💎 TON
            </button>
            <button
              onClick={() => setChainFilter('solana')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                chainFilter === 'solana' ? 'bg-[#9945FF] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              🟣 Solana
            </button>
          </div>
        </div>

        {/* Wallet List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[300px]">
          {filteredWallets.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              No wallets found matching your filter criteria.
            </div>
          ) : (
            filteredWallets.map(w => {
              const isSol = isSolanaWallet(w);
              const isCurrent = w.id === currentTreasuryId || w.isMainWallet;
              const balNum = parseFloat(w.balance || '0');
              const heldTokens = (w.jettons || []).filter(j => parseFloat(j.balance || '0') > 0);

              return (
                <div
                  key={w.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent 
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5' 
                      : 'bg-[#0c1222]/80 border-white/10 hover:border-white/20 hover:bg-[#0c1222]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isCurrent 
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                        : isSol 
                          ? 'bg-[#9945FF]/15 text-[#14F195] border-[#14F195]/20' 
                          : 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/20'
                    }`}>
                      {isCurrent ? <Crown className="w-5 h-5 text-amber-400" /> : <Coins className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          isSol 
                            ? 'bg-[#9945FF]/20 text-[#14F195] border-[#14F195]/30' 
                            : 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30'
                        }`}>
                          {isSol ? 'SOL' : 'TON'}
                        </span>
                        <h4 className="text-sm font-bold text-white truncate">{w.label}</h4>
                        {isCurrent && (
                          <span className="badge badge-gold text-[10px] py-0 font-bold flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> Current Treasury
                          </span>
                        )}
                        <span className="badge badge-primary text-[10px] py-0">{w.version}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 font-mono text-xs text-gray-400">
                        <span className="truncate">
                          {w.address.substring(0, 8)}...{w.address.substring(w.address.length - 6)}
                        </span>
                        <span>•</span>
                        <span className="text-white font-bold">{w.balance} {isSol ? 'SOL' : 'TON'}</span>
                        <span className="text-gray-500 text-[11px]">
                          (≈ {isSol ? PriceService.formatSolUsd(balNum) : PriceService.formatUsd(balNum)})
                        </span>
                      </div>

                      {/* Display ONLY tokens that this wallet holds */}
                      {heldTokens.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-gray-500 font-semibold">Tokens:</span>
                          {heldTokens.map(tok => (
                            <span 
                              key={tok.symbol} 
                              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-amber-300 font-bold"
                            >
                              <span>{tok.icon || '🪙'}</span>
                              <span>{tok.balance}</span>
                              <span className="text-gray-400">{tok.symbol}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 sm:self-center">
                    {isCurrent ? (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>Active Treasury</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSwitch(w)}
                        className="btn btn-gold btn-sm text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/10 py-1.5 px-3"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Set as Treasury</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>{wallets.length} total wallets in vault</span>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm text-xs font-semibold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
