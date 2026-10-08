import React, { useState, useMemo } from 'react';
import type { ManagedWallet, Network } from '../types';
import { isSolanaWallet } from '../types';
import { PriceService, type PriceData } from '../services/priceService';
import { 
  SolanaService, 
  SOLANA_BASE_TX_FEE_SOL, 
  SOLANA_ATA_RENT_SOL, 
  type SolanaDistributionCostEstimate
} from '../services/solanaService';
import { 
  X, 
  Zap, 
  Fuel, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Coins, 
  Users, 
  Info, 
  ArrowRight
} from 'lucide-react';

interface SolanaDistributionCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  mainWallet?: ManagedWallet | null;
  network?: Network;
  initialToken?: string;
  onLaunchDistribute?: (tokenSymbol: string, targetWallets: ManagedWallet[]) => void;
}

export const SolanaDistributionCostModal: React.FC<SolanaDistributionCostModalProps> = ({
  isOpen,
  onClose,
  wallets,
  mainWallet,
  network: _network = 'mainnet',
  initialToken = 'SOL',
  onLaunchDistribute,
}) => {
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<string>(initialToken);
  const [customTokenInput, setCustomTokenInput] = useState<string>('');
  const [walletFilterMode, setWalletFilterMode] = useState<'all-solana' | 'all-studio' | 'funded-only' | 'empty-only'>('all-solana');
  const [showRecipientTable, setShowRecipientTable] = useState<boolean>(false);
  const [priceData] = useState<PriceData>(PriceService.getPrices());

  React.useEffect(() => {
    if (isOpen && initialToken) {
      setSelectedTokenSymbol(initialToken);
      setCustomTokenInput('');
    }
  }, [isOpen, initialToken]);

  // Filter available target wallets
  const targetWallets = useMemo(() => {
    const solOnly = wallets.filter(w => isSolanaWallet(w) || !!w.privateKey);
    const pool = walletFilterMode === 'all-studio' ? wallets : solOnly;

    if (walletFilterMode === 'funded-only') {
      return pool.filter(w => parseFloat(w.balance || '0') > 0 || (w.jettons || []).some(j => parseFloat(j.balance || '0') > 0));
    }
    if (walletFilterMode === 'empty-only') {
      return pool.filter(w => parseFloat(w.balance || '0') === 0 && (!w.jettons || w.jettons.every(j => parseFloat(j.balance || '0') === 0)));
    }
    return pool;
  }, [wallets, walletFilterMode]);

  // Aggregate all unique tokens held across all Solana wallets
  const availableHeldTokens = useMemo(() => {
    const map = new Map<string, { symbol: string; name?: string; icon?: string }>();
    map.set('SOL', { symbol: 'SOL', name: 'Solana (Native)', icon: '🟣' });

    wallets.forEach(w => {
      w.jettons?.forEach(j => {
        if (parseFloat(j.balance || '0') > 0 && j.symbol !== 'SOL' && j.symbol !== 'TON') {
          if (!map.has(j.symbol.toUpperCase())) {
            map.set(j.symbol.toUpperCase(), { 
              symbol: j.symbol, 
              name: j.name, 
              icon: j.icon || '🪙' 
            });
          }
        }
      });
    });

    return Array.from(map.values());
  }, [wallets]);

  // Treasury SOL balance for coverage check
  const treasurySolBalance = useMemo(() => {
    if (!mainWallet) return 0;
    if (isSolanaWallet(mainWallet) || !!mainWallet.privateKey) {
      return parseFloat(mainWallet.balance || '0');
    }
    // If main wallet is TON, check if there is a designated Solana treasury or first solana wallet
    const solTreasury = wallets.find(w => isSolanaWallet(w) || !!w.privateKey);
    return solTreasury ? parseFloat(solTreasury.balance || '0') : 0;
  }, [mainWallet, wallets]);

  const activeTokenSymbol = customTokenInput.trim() ? customTokenInput.trim().toUpperCase() : selectedTokenSymbol;

  // Calculate detailed cost breakdown
  const costEstimate: SolanaDistributionCostEstimate = useMemo(() => {
    return SolanaService.calculateDistributionCost(
      targetWallets,
      activeTokenSymbol,
      treasurySolBalance,
      priceData.solUsd || 154.20
    );
  }, [targetWallets, activeTokenSymbol, treasurySolBalance, priceData.solUsd]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF]/30 to-[#14F195]/20 border border-[#14F195]/30 flex items-center justify-center text-[#14F195] shadow-lg shadow-[#14F195]/10">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>Solana Token Distribution Cost Estimator</span>
              </h2>
              <p className="text-xs text-gray-400">
                Calculates exact SOL network fees & token account rent to disperse to all added wallets
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          
          {/* Target Wallets Filter Bar */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#14F195]" /> Target Recipient Wallets:
              </span>
              <span className="text-[11px] font-mono text-[#14F195] font-bold">
                {targetWallets.length} Wallets Selected
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setWalletFilterMode('all-solana')}
                className={`py-1.5 px-2.5 rounded-lg border font-semibold transition-all text-center ${
                  walletFilterMode === 'all-solana' 
                    ? 'bg-[#14F195]/20 border-[#14F195] text-white shadow-sm' 
                    : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                All Solana ({wallets.filter(w => isSolanaWallet(w) || !!w.privateKey).length})
              </button>
              <button
                type="button"
                onClick={() => setWalletFilterMode('all-studio')}
                className={`py-1.5 px-2.5 rounded-lg border font-semibold transition-all text-center ${
                  walletFilterMode === 'all-studio' 
                    ? 'bg-[#14F195]/20 border-[#14F195] text-white shadow-sm' 
                    : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                All Studio ({wallets.length})
              </button>
              <button
                type="button"
                onClick={() => setWalletFilterMode('funded-only')}
                className={`py-1.5 px-2.5 rounded-lg border font-semibold transition-all text-center ${
                  walletFilterMode === 'funded-only' 
                    ? 'bg-[#14F195]/20 border-[#14F195] text-white shadow-sm' 
                    : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                Funded Only
              </button>
              <button
                type="button"
                onClick={() => setWalletFilterMode('empty-only')}
                className={`py-1.5 px-2.5 rounded-lg border font-semibold transition-all text-center ${
                  walletFilterMode === 'empty-only' 
                    ? 'bg-[#14F195]/20 border-[#14F195] text-white shadow-sm' 
                    : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                Empty Only
              </button>
            </div>
          </div>

          {/* Token Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> Select Token to Distribute:
              </span>
              <span className="text-[11px] text-gray-400">
                Active: <strong className="text-white font-mono">{activeTokenSymbol}</strong>
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {availableHeldTokens.map(t => (
                <button
                  key={t.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedTokenSymbol(t.symbol);
                    setCustomTokenInput('');
                  }}
                  className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                    !customTokenInput && selectedTokenSymbol.toUpperCase() === t.symbol.toUpperCase()
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                      : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.symbol}</span>
                </button>
              ))}
            </div>

            {/* Custom Mint or Symbol Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Or paste any custom SPL token mint address or symbol..."
                value={customTokenInput}
                onChange={(e) => setCustomTokenInput(e.target.value)}
                className="input-field text-xs py-1.5 flex-1 font-mono"
              />
              {customTokenInput && (
                <button
                  type="button"
                  onClick={() => setCustomTokenInput('')}
                  className="btn btn-secondary btn-sm text-xs py-1.5"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* BIG SUMMARY CARD: TOTAL SOL COST */}
          <div className="bg-gradient-to-br from-[#121b30] to-[#0c1322] p-4 rounded-2xl border border-[#14F195]/40 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-[#14F195]" />
                  Total SOL Required for Bulk Distribution:
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-[#14F195] font-mono tracking-tight">
                    {costEstimate.totalSolCost.toFixed(6)} SOL
                  </span>
                  <span className="text-sm font-bold text-gray-300 font-mono">
                    ≈ ${costEstimate.totalUsdCost.toFixed(2)} USD
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  To distribute <strong className="text-white">{activeTokenSymbol}</strong> to all <strong className="text-white">{costEstimate.recipientCount}</strong> selected wallets on Solana
                </p>
              </div>

              {/* Treasury Gas Readiness Indicator */}
              <div className="bg-[#080d1a] p-3 rounded-xl border border-white/10 sm:text-right shrink-0">
                <span className="text-[10px] text-gray-400 block font-semibold">Treasury SOL Available:</span>
                <span className="text-sm font-mono font-black text-white block">
                  {treasurySolBalance.toFixed(4)} SOL
                </span>
                <div className="mt-1">
                  {costEstimate.hasEnoughSolForGas ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Fully Funded for Gas
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <AlertCircle className="w-3 h-3" /> Needs +{costEstimate.solDeficit.toFixed(4)} SOL
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED COST BREAKDOWN TILES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            
            {/* Tile 1: Base Network Signature Fees */}
            <div className="bg-[#0e1627] p-3.5 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-300 flex items-center gap-1.5">
                  <span>⚡</span> Network Transaction Fees
                </span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {costEstimate.totalTxFeesSol.toFixed(6)} SOL
                </span>
              </div>
              <div className="text-[11px] text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Base fee per transfer:</span>
                  <span className="font-mono text-gray-300">{SOLANA_BASE_TX_FEE_SOL} SOL (5,000 lamports)</span>
                </div>
                <div className="flex justify-between">
                  <span>Total transactions:</span>
                  <span className="font-mono text-gray-300">{costEstimate.recipientCount} txs</span>
                </div>
                <div className="flex justify-between text-gray-500 pt-0.5 border-t border-white/5">
                  <span>Network USD equivalent:</span>
                  <span className="font-mono">${(costEstimate.totalTxFeesSol * (priceData.solUsd || 154.20)).toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Tile 2: Associated Token Account (ATA) Rent */}
            <div className="bg-[#0e1627] p-3.5 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-300 flex items-center gap-1.5">
                  <span>🪙</span> Token Account (ATA) Rent
                </span>
                <span className="font-mono font-black text-amber-400 text-sm">
                  {costEstimate.totalAtaRentCostSol.toFixed(6)} SOL
                </span>
              </div>
              <div className="text-[11px] text-gray-400 space-y-1">
                {costEstimate.isNativeSol ? (
                  <p className="text-gray-500 italic text-[11px]">
                    Native SOL transfers do not require token accounts. ATA rent is 0 SOL!
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Rent per new ATA (165 bytes):</span>
                      <span className="font-mono text-gray-300">~{SOLANA_ATA_RENT_SOL.toFixed(6)} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wallets needing new ATA:</span>
                      <span className="font-mono text-amber-300 font-bold">{costEstimate.newAtasNeededCount} wallets</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wallets already holding ATA:</span>
                      <span className="font-mono text-emerald-400">{costEstimate.existingAtasCount} wallets (0 SOL)</span>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Educational Note about Solana Token Account Rent */}
          {!costEstimate.isNativeSol && (
            <div className="bg-[#080d1a] p-3 rounded-xl border border-white/5 flex items-start gap-2.5 text-[11px] text-gray-400">
              <Info className="w-4 h-4 text-[#0098EA] shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-300">Why does distributing SPL tokens cost ATA rent?</strong>
                <p className="mt-0.5 text-gray-400 leading-relaxed">
                  On Solana, every token requires a 165-byte Associated Token Account on the recipient wallet. Rent-exemption requires depositing <strong>0.00203928 SOL</strong> per new account. Once created, future transfers to that wallet require <strong>0 SOL rent</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Collapsible Recipient Wallets List with ATA Status */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRecipientTable(!showRecipientTable)}
              className="w-full bg-[#0a0f1d] hover:bg-[#0e1627] p-3 flex items-center justify-between text-xs font-semibold text-gray-300 transition-all text-left"
            >
              <span className="flex items-center gap-1.5">
                <span>📋</span> View Wallet-by-Wallet Cost Breakdown ({costEstimate.recipientCount} Recipients)
              </span>
              <span className="text-[#0098EA] hover:underline">
                {showRecipientTable ? 'Hide Table ▲' : 'Show Table ▼'}
              </span>
            </button>

            {showRecipientTable && (
              <div className="max-h-60 overflow-y-auto divide-y divide-white/5 text-xs bg-[#060913]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#0e1627] text-gray-400 text-[10px] uppercase font-semibold">
                      <th className="p-2">Wallet</th>
                      <th className="p-2">Address</th>
                      <th className="p-2 text-center">ATA Status</th>
                      <th className="p-2 text-right">Fee (SOL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {targetWallets.map(w => {
                      const hasAta = costEstimate.isNativeSol || (w.jettons || []).some(
                        j => j.symbol.toUpperCase() === activeTokenSymbol && parseFloat(j.balance || '0') > 0
                      );
                      const walletSolFee = SOLANA_BASE_TX_FEE_SOL + (hasAta ? 0 : SOLANA_ATA_RENT_SOL);

                      return (
                        <tr key={w.id} className="hover:bg-white/5">
                          <td className="p-2 font-sans font-bold text-white truncate max-w-[120px]">
                            {w.label}
                          </td>
                          <td className="p-2 text-gray-400 text-[11px]">
                            {w.address.substring(0, 6)}...{w.address.substring(w.address.length - 4)}
                          </td>
                          <td className="p-2 text-center">
                            {hasAta ? (
                              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-sans font-semibold">
                                Ready (0 rent)
                              </span>
                            ) : (
                              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-sans font-semibold">
                                New ATA Needed
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-bold text-[#14F195]">
                            {walletSolFee.toFixed(6)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="text-xs text-gray-400">
            <span>Solana Mainnet Fee Engine • </span>
            <span className="font-mono text-emerald-400 font-bold">5,000 lamports/tx</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm flex-1 sm:flex-initial"
            >
              Close
            </button>
            {onLaunchDistribute && (
              <button
                type="button"
                onClick={() => {
                  onLaunchDistribute(activeTokenSymbol, targetWallets);
                  onClose();
                }}
                className="btn btn-primary btn-sm flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shadow-lg shadow-[#0098EA]/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Distribute {activeTokenSymbol} Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
