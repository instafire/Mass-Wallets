import React, { useState, useEffect } from 'react';
import type { ManagedWallet, Network } from '../types';
import { isSolanaWallet } from '../types';
import { 
  Crown, 
  Copy, 
  Check, 
  Send, 
  QrCode, 
  Key, 
  History, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownToLine, 
  Fuel,
  Zap,
  Coins
} from 'lucide-react';
import { PriceService, type PriceData } from '../services/priceService';
import { SUPPORTED_SOLANA_TOKENS, SOLANA_BASE_TX_FEE_SOL, SOLANA_ATA_RENT_SOL } from '../services/solanaService';

interface MainTreasuryCardProps {
  mainWallet: ManagedWallet | null;
  allWallets: ManagedWallet[];
  network: Network;
  onOpenDistribute: () => void;
  onOpenSweep: () => void;
  onOpenGasBalancer?: () => void;
  onOpenNFTGallery?: () => void;
  onOpenReceive: (wallet: ManagedWallet) => void;
  onOpenSend: (wallet: ManagedWallet) => void;
  onOpenKeys: (wallet: ManagedWallet) => void;
  onOpenHistory: (wallet: ManagedWallet) => void;
  onSetFirstAsMain: () => void;
  onCreateMainWallet: () => void;
  onOpenSwitchTreasury?: () => void;
  onViewHoldings?: (wallet: ManagedWallet) => void;
  onOpenSolanaCostEstimator?: (tokenSymbol?: string) => void;
}

export const MainTreasuryCard: React.FC<MainTreasuryCardProps> = ({
  mainWallet,
  allWallets,
  onOpenDistribute,
  onOpenSweep,
  onOpenGasBalancer,
  onOpenNFTGallery,
  onOpenReceive,
  onOpenSend,
  onOpenKeys,
  onOpenHistory,
  onSetFirstAsMain,
  onCreateMainWallet,
  onOpenSwitchTreasury,
  onViewHoldings,
  onOpenSolanaCostEstimator,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [priceData, setPriceData] = useState<PriceData>(PriceService.getPrices());

  useEffect(() => {
    return PriceService.subscribe(setPriceData);
  }, []);

  const recipientCount = allWallets.filter(w => !mainWallet || w.id !== mainWallet.id).length;

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!mainWallet) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-4">
        <div className="treasury-card p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0 shadow-lg shadow-amber-500/10">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Master Funding Treasury Vault</h3>
                <span className="badge badge-gold">Central Hub</span>
              </div>
              <p className="text-xs text-gray-400">
                Designate a primary funding vault to distribute TON & Solana assets to all {allWallets.length} studio wallets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {allWallets.length > 0 && (
              <button
                onClick={onSetFirstAsMain}
                className="btn btn-secondary btn-sm text-xs font-bold"
              >
                Set Wallet #1 as Main
              </button>
            )}
            <button
              onClick={onCreateMainWallet}
              className="btn btn-gold btn-sm text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <Sparkles className="w-4 h-4" />
              Create Master Treasury
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSolana = isSolanaWallet(mainWallet);
  const shortAddress = `${mainWallet.address.substring(0, 8)}...${mainWallet.address.substring(mainWallet.address.length - 6)}`;
  const treasuryBalNum = parseFloat(mainWallet.balance || '0');
  const treasuryNativeUsdVal = isSolana ? (treasuryBalNum * (priceData.solUsd || 154.20)) : (treasuryBalNum * (priceData.tonUsd || 5.42));
  const estimatedGas = isSolana ? recipientCount * 0.000005 : recipientCount * 0.002;

  // Filter secondary jettons / SPL tokens that have positive balances
  const activeTokens = mainWallet.jettons?.filter(j => parseFloat(j.balance || '0') > 0 && j.symbol !== 'TON' && j.symbol !== 'SOL') || [];
  
  // Calculate total USD value (Native SOL/TON + All Held Tokens)
  const tokensUsdVal = activeTokens.reduce((sum, t) => {
    const bal = parseFloat(t.balance || '0');
    const tokenPrice = isSolana
      ? (SUPPORTED_SOLANA_TOKENS.find(s => s.symbol === t.symbol)?.usdPrice || priceData.tokens[t.symbol.toUpperCase()] || 0)
      : (priceData.tokens[t.symbol.toUpperCase()] || 0);
    return sum + (bal * tokenPrice);
  }, 0);
  const totalTreasuryUsdVal = treasuryNativeUsdVal + tokensUsdVal;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-4">
      <div className="treasury-card p-5 sm:p-6">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Left: Treasury Identification & Jettons Strip */}
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-black flex items-center justify-center font-extrabold shadow-lg shadow-amber-500/25 shrink-0">
                <Crown className="w-6 h-6 text-[#070a14]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">{mainWallet.label}</h3>
                  <span className={isSolana ? "badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30 font-bold" : "badge badge-gold font-bold"}>
                    {isSolana ? '👑 Solana Master Treasury' : '👑 Master Treasury'}
                  </span>
                  {onOpenSwitchTreasury && allWallets.length > 1 && (
                    <button
                      type="button"
                      onClick={onOpenSwitchTreasury}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center gap-1 shadow-sm"
                      title="Switch Master Treasury to another wallet"
                    >
                      <Crown className="w-2.5 h-2.5 text-amber-400" />
                      <span>Switch Treasury</span>
                    </button>
                  )}
                  <span className="badge badge-primary">{mainWallet.version}</span>
                  {isSolana && mainWallet.squadsVaultAddress && (
                    <span className="badge bg-purple-500/20 text-purple-300 font-mono text-[10px]" title={`Squads v4 Vault PDA: ${mainWallet.squadsVaultAddress}`}>
                      🛡️ Squads v4 Vault: {mainWallet.squadsVaultAddress.substring(0, 6)}...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs text-gray-300 bg-[#070a14] px-2.5 py-1 rounded-lg border border-white/10 select-all">
                    {shortAddress}
                  </span>
                  <button
                    onClick={() => handleCopy(mainWallet.address)}
                    className="p-1 rounded-lg text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all flex items-center gap-1 text-xs"
                    title="Copy Treasury Address"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Token Assets Mini-Bar - Displays ONLY held tokens */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#070a14] px-2.5 py-1 rounded-lg border border-white/5">
                <Coins className={`w-3 h-3 ${isSolana ? 'text-purple-400' : 'text-[#0098EA]'}`} />
                <span className="font-semibold text-gray-300">Vault Assets:</span>
              </div>
              {activeTokens.length > 0 ? (
                activeTokens.map(t => (
                  <span 
                    key={t.symbol} 
                    className="inline-flex items-center gap-1 bg-amber-500/15 text-[11px] font-mono px-2 py-0.5 rounded-lg border border-amber-500/40 text-amber-300 font-bold shadow-sm"
                    title={t.name}
                  >
                    <span>{t.icon || '🪙'}</span>
                    <span>{parseFloat(t.balance || '0').toLocaleString()}</span>
                    <span className="text-amber-400 text-[10px]">{t.symbol}</span>
                    {t.jettonAddress?.endsWith('pump') && (
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 rounded ml-0.5">pump</span>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-[11px] italic">No secondary tokens held</span>
              )}
            </div>

            {/* Quick Gas / Solana Distribution Cost Requirement Badge */}
            {recipientCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <Fuel className={`w-3.5 h-3.5 ${isSolana ? 'text-[#14F195]' : 'text-amber-400'} shrink-0`} />
                <span>
                  {isSolana ? (
                    <>
                      Estimated SOL to distribute to all {recipientCount} wallets: <strong className="text-[#14F195] font-mono">
                        ~{(recipientCount * SOLANA_BASE_TX_FEE_SOL).toFixed(6)} SOL
                      </strong>
                      {activeTokens.length > 0 && (
                        <span className="text-gray-400 font-sans ml-1 text-[11px]">
                          (or ~{(recipientCount * (SOLANA_BASE_TX_FEE_SOL + SOLANA_ATA_RENT_SOL)).toFixed(4)} SOL max for SPL tokens)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Estimated gas for all {recipientCount} wallets: <strong className="text-amber-300 font-mono">
                        ~{estimatedGas.toFixed(3)} TON
                      </strong> (Eco Mode)
                    </>
                  )}
                </span>
                {isSolana && onOpenSolanaCostEstimator && (
                  <button
                    type="button"
                    onClick={() => onOpenSolanaCostEstimator()}
                    className="text-[11px] text-[#14F195] hover:text-[#14F195]/80 bg-[#14F195]/10 border border-[#14F195]/30 px-2 py-0.5 rounded-lg font-bold ml-1 flex items-center gap-1 transition-all shadow-sm"
                    title="Calculate exact SOL cost to distribute any token across all wallets"
                  >
                    <Zap className="w-3 h-3 text-[#14F195]" />
                    <span>SOL Cost Estimator ⚡</span>
                  </button>
                )}
                {!isSolana && onOpenGasBalancer && (
                  <button
                    onClick={onOpenGasBalancer}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold ml-1 flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3" /> Auto-Balancer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Middle: TON/SOL Balance Box */}
          <div className="bg-[#070a14]/90 px-6 py-4 rounded-2xl border border-white/10 shrink-0 text-center sm:text-left shadow-lg">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 justify-center sm:justify-start">
              <span>{isSolana ? '🟣' : '💎'}</span> Treasury {isSolana ? 'SOL' : 'TON'} Balance
            </span>
            <div className="flex items-baseline gap-1.5 mt-1 justify-center sm:justify-start">
              <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {mainWallet.balance}
              </span>
              <span className="text-xs text-gray-300 font-bold">{isSolana ? 'SOL' : 'TON'}</span>
            </div>
            <p className="text-xs text-emerald-400/90 font-mono font-bold mt-0.5">
              ≈ {isSolana ? PriceService.formatSolUsd(totalTreasuryUsdVal) : PriceService.formatUsd(totalTreasuryUsdVal, false)}
            </p>
            {activeTokens.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1.5 items-center justify-center sm:justify-start">
                {activeTokens.map(t => (
                  <span
                    key={t.symbol}
                    className="inline-flex items-center gap-1 bg-[#121b30] px-2 py-0.5 rounded-lg border border-amber-500/30 text-xs font-mono text-amber-300 font-bold shadow-sm"
                  >
                    <span>{t.icon || '🪙'}</span>
                    <span>{parseFloat(t.balance || '0').toLocaleString()} {t.symbol}</span>
                    {t.jettonAddress?.endsWith('pump') && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded border border-emerald-500/30 font-sans">
                        pump.fun
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {mainWallet.nfts && mainWallet.nfts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <span className="text-[11px] text-purple-300 font-semibold flex items-center gap-1">
                  <span>🖼️</span> {mainWallet.nfts.length} Vault {mainWallet.nfts.length === 1 ? 'NFT' : 'NFTs'}
                </span>
                {onOpenNFTGallery && (
                  <button
                    onClick={onOpenNFTGallery}
                    className="text-[10px] text-purple-400 hover:text-purple-200 underline font-semibold"
                  >
                    View
                  </button>
                )}
              </div>
            )}

            {onViewHoldings && (
              <div className="mt-2.5 pt-2 border-t border-white/10 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => onViewHoldings(mainWallet)}
                  className="text-[11px] text-[#0098EA] hover:text-[#38bdf8] font-bold flex items-center gap-1 mx-auto sm:mx-0 transition-colors cursor-pointer"
                >
                  <span>View All Holdings & Assets →</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Actions & Distribute Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenDistribute}
                disabled={recipientCount === 0}
                className="flex-1 btn btn-gold py-2.5 px-4 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Distribute to {recipientCount} Wallets</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-0.5 opacity-80" />
              </button>

              <button
                onClick={onOpenSweep}
                disabled={recipientCount === 0}
                className="btn btn-secondary py-2.5 px-3 text-xs font-bold text-[#0098EA] border-[#0098EA]/30 hover:bg-[#0098EA]/10 flex items-center gap-1"
                title="Sweep all sub-wallet balances back to Master Treasury"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Sweep</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenReceive(mainWallet)}
                className="flex-1 btn btn-secondary btn-sm text-xs font-semibold flex items-center justify-center gap-1 py-2"
                title="Deposit TON to Treasury"
              >
                <QrCode className="w-3.5 h-3.5 text-[#0098EA]" />
                <span>Deposit</span>
              </button>

              <button
                onClick={() => onOpenSend(mainWallet)}
                className="flex-1 btn btn-secondary btn-sm text-xs font-semibold flex items-center justify-center gap-1 py-2"
                title="Send from Treasury"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>Send</span>
              </button>

              <button
                onClick={() => onOpenKeys(mainWallet)}
                className="btn btn-secondary btn-sm text-xs font-semibold px-2.5 py-2 text-amber-400"
                title="Treasury Secret Seed Phrase"
              >
                <Key className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onOpenHistory(mainWallet)}
                className="btn btn-secondary btn-sm text-xs font-semibold px-2.5 py-2 text-purple-400"
                title="Treasury On-Chain History"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
