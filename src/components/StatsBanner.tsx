import React, { useState, useEffect } from 'react';
import type { ManagedWallet, Network } from '../types';
import { Wallet, Coins, Fuel, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { PriceService, type PriceData } from '../services/priceService';

interface StatsBannerProps {
  wallets: ManagedWallet[];
  network: Network;
  onOpenGasBalancer?: () => void;
  onOpenNFTGallery?: () => void;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({ wallets, network: _network, onOpenGasBalancer, onOpenNFTGallery: _onOpenNFTGallery }) => {
  const [priceData, setPriceData] = useState<PriceData>(PriceService.getPrices());

  useEffect(() => {
    const unsub = PriceService.subscribe(setPriceData);
    PriceService.fetchLatestPrices();
    return unsub;
  }, []);

  const totalWallets = wallets.length;
  
  // TON stats
  const tonWallets = wallets.filter(w => !w.chain || w.chain === 'ton');
  const totalTonBalance = tonWallets.reduce((acc, w) => {
    const val = parseFloat(w.balance || '0');
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Solana stats
  const solWallets = wallets.filter(w => w.chain === 'solana');
  const totalSolBalance = solWallets.reduce((acc, w) => {
    const val = parseFloat(w.balance || '0');
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const tonUsdValuation = totalTonBalance * (priceData.tonUsd || 0);
  const solUsdValuation = totalSolBalance * (priceData.solUsd || 154.20);
  const totalUsdValuation = tonUsdValuation + solUsdValuation;

  const nonZeroWallets = wallets.filter(w => parseFloat(w.balance || '0') > 0).length;
  const gasReadyWallets = tonWallets.filter(w => parseFloat(w.balance || '0') >= 0.005).length;
  const lowGasWallets = tonWallets.filter(w => {
    const b = parseFloat(w.balance || '0');
    return b > 0 && b < 0.005 && !w.isMainWallet;
  }).length;

  const squadsCount = wallets.filter(w => w.version === 'squads-v4' || !!w.squadsVaultAddress).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 pb-2">
      <div className="glass-card px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border border-white/10 shadow-lg text-xs rounded-xl">
        
        {/* Section 1: Total Wallets */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-lg bg-[#0098EA]/15 text-[#0098EA] flex items-center justify-center shrink-0">
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-gray-400 text-[11px] font-medium mr-1.5">Total Wallets:</span>
            <strong className="text-white font-bold text-sm font-mono">{totalWallets.toLocaleString()}</strong>
            <span className="text-gray-500 text-[11px] ml-1.5 hidden sm:inline">
              (<span className="text-emerald-400 font-medium">{nonZeroWallets} funded</span> • <span className="text-gray-400">{totalWallets - nonZeroWallets} empty</span>)
            </span>
          </div>
        </div>

        <div className="hidden lg:block h-4 w-[1px] bg-white/10" />

        {/* Section 2: Portfolio Total Balance */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Coins className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <span className="text-gray-400 text-[11px] font-medium mr-1.5">Portfolio Value:</span>
              <strong className="text-emerald-400 font-bold text-sm font-mono">
                {PriceService.formatUsd(totalUsdValuation, false)}
              </strong>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-gray-400 font-sans">|</span>
              <span className="text-gray-300">
                💎 {totalTonBalance.toFixed(2)} TON
              </span>
              {solWallets.length > 0 && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-[#14F195]">
                    🟣 {totalSolBalance.toFixed(2)} SOL
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="hidden lg:block h-4 w-[1px] bg-white/10" />

        {/* Section 3: Gas Readiness / Multi-chain Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Fuel className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px] font-medium mr-1">Gas:</span>
            <span className="text-emerald-400 font-bold font-mono text-[11px]">{gasReadyWallets} Ready</span>
            {lowGasWallets > 0 && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-amber-400 font-bold font-mono text-[11px]">{lowGasWallets} Low</span>
                {onOpenGasBalancer && (
                  <button
                    onClick={onOpenGasBalancer}
                    className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <Zap className="w-2.5 h-2.5 text-amber-300" />
                    <span>Auto-Gas</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="hidden lg:block h-4 w-[1px] bg-white/10" />

        {/* Section 4: Live Prices (TON + SOL) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* TON Price */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">TON:</span>
            <strong className="text-white font-bold font-mono">${(priceData.tonUsd || 0).toFixed(2)}</strong>
            <span className={`text-[10px] font-bold flex items-center ${(priceData.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(priceData.change24h || 0) >= 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
              {(priceData.change24h || 0) >= 0 ? '+' : ''}{(priceData.change24h || 0).toFixed(1)}%
            </span>
          </div>

          {/* SOL Price */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            <span className="text-[#14F195] text-[11px] font-bold">SOL:</span>
            <strong className="text-white font-bold font-mono">${(priceData.solUsd || 154.20).toFixed(2)}</strong>
            <span className={`text-[10px] font-bold flex items-center ${(priceData.change24hSol || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(priceData.change24hSol || 0) >= 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
              {(priceData.change24hSol || 0) >= 0 ? '+' : ''}{(priceData.change24hSol || 0).toFixed(1)}%
            </span>
          </div>

          {/* Squads v4 Badge if present */}
          {squadsCount > 0 && (
            <span className="badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30 text-[10px] px-1.5 py-0.5">
              Squads v4: {squadsCount}
            </span>
          )}
        </div>

      </div>
    </div>
  );
};
