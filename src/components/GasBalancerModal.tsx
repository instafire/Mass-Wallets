import React, { useState } from 'react';
import { 
  X, 
  Fuel, 
  RefreshCw, 
  AlertTriangle, 
  Zap
} from 'lucide-react';
import type { ManagedWallet, Network } from '../types';
import { TonService } from '../services/tonService';
import { ActivityService } from '../services/activityService';
import confetti from 'canvas-confetti';

interface GasBalancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mainWallet: ManagedWallet | null;
  allWallets: ManagedWallet[];
  network: Network;
  onGasBalancingCompleted: () => void;
}

export const GasBalancerModal: React.FC<GasBalancerModalProps> = ({
  isOpen,
  onClose,
  mainWallet,
  allWallets,
  network,
  onGasBalancingCompleted,
}) => {
  const [gasThreshold, setGasThreshold] = useState<number>(0.02);
  const [topUpTarget, setTopUpTarget] = useState<number>(0.05);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  if (!isOpen || !mainWallet) return null;

  // Find sub-wallets that have balance < gasThreshold (TON wallets only —
  // topping up a Solana wallet with TON math is meaningless).
  const underfundedWallets = allWallets
    .filter(w => w.id !== mainWallet.id && (!w.chain || w.chain === 'ton'))
    .map(w => {
      const bal = parseFloat(w.balance || '0');
      const deficit = Math.max(0, topUpTarget - bal);
      return {
        wallet: w,
        currentBalance: bal,
        needed: deficit,
        isUnderfunded: bal < gasThreshold && deficit > 0.0001,
      };
    })
    .filter(item => item.isUnderfunded);

  const totalNeededTon = underfundedWallets.reduce((sum, item) => sum + item.needed, 0);
  const treasuryBalance = parseFloat(mainWallet.balance || '0');
  // Real per-transfer fee on TON is ~0.01, not 0.002 — the old value let the
  // sufficiency check pass when the treasury couldn't actually cover fees.
  const networkFeePerTx = 0.01;
  const totalEstimatedFees = underfundedWallets.length * networkFeePerTx;
  const totalCost = totalNeededTon + totalEstimatedFees;
  const hasSufficientTreasury = treasuryBalance >= totalCost;

  const handleStartAutoGas = async () => {
    if (underfundedWallets.length === 0 || !hasSufficientTreasury) return;

    setIsExecuting(true);
    setProgress({ current: 0, total: underfundedWallets.length });

    let successCount = 0;
    let distributedTon = 0;

    for (let i = 0; i < underfundedWallets.length; i++) {
      const item = underfundedWallets[i];
      setProgress({ current: i + 1, total: underfundedWallets.length });

      try {
        const res = await TonService.sendTransaction(
          mainWallet,
          item.wallet.address,
          item.needed.toFixed(4),
          'Gas Auto-Balancer Top-Up',
          network,
          'TON'
        );

        if (res.success) {
          successCount++;
          distributedTon += item.needed;
        }
      } catch (err) {
        console.error('Auto gas send error:', err);
      }

      if (i < underfundedWallets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }

    ActivityService.log({
      type: 'send',
      title: 'Gas Auto-Balance Completed',
      description: `Funded ${successCount} underfunded wallets with ~${distributedTon.toFixed(3)} TON.`,
      walletCount: successCount,
      amount: distributedTon.toFixed(3),
      token: 'TON',
      status: successCount > 0 ? 'success' : 'failed',
    });

    setIsExecuting(false);
    if (successCount > 0) {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
    }
    onGasBalancingCompleted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="glass-card max-w-2xl w-full p-6 border border-white/20 shadow-2xl relative space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-md shadow-amber-500/10">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Smart Gas Station & Auto-Balancer</h2>
                <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                  Gas Optimizer
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Identify and fund all sub-wallets lacking sufficient gas for on-chain transfers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#080d1a] p-4 rounded-xl border border-white/10">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Gas Deficit Threshold:
            </label>
            <div className="flex items-center gap-1.5">
              {[0.005, 0.01, 0.02, 0.05].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => { setGasThreshold(val); setTopUpTarget(val); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    gasThreshold === val
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  &lt; {val}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Target Balance After Top-Up:
            </label>
            <div className="flex items-center gap-1.5">
              {[0.005, 0.01, 0.02, 0.05].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTopUpTarget(val)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    topUpTarget === val
                      ? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA]'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {val} TON
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Metrics Overview */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-[#121b30] p-3 rounded-xl border border-white/10">
            <span className="text-[11px] text-gray-400 block">Underfunded Wallets</span>
            <span className="text-xl font-bold text-amber-400 font-mono mt-0.5 block">
              {underfundedWallets.length}
            </span>
          </div>

          <div className="bg-[#121b30] p-3 rounded-xl border border-white/10">
            <span className="text-[11px] text-gray-400 block">Total Gas Required</span>
            <span className="text-xl font-bold text-emerald-400 font-mono mt-0.5 block">
              {totalNeededTon.toFixed(3)} <span className="text-xs font-sans text-gray-400">TON</span>
            </span>
          </div>

          <div className="bg-[#121b30] p-3 rounded-xl border border-white/10">
            <span className="text-[11px] text-gray-400 block">Treasury Available</span>
            <span className="text-xl font-bold text-white font-mono mt-0.5 block">
              {treasuryBalance.toFixed(2)} <span className="text-xs font-sans text-gray-400">TON</span>
            </span>
          </div>
        </div>

        {/* Warning if insufficient funds */}
        {!hasSufficientTreasury && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Master Treasury does not have enough TON ({treasuryBalance.toFixed(3)} available vs ~{totalCost.toFixed(3)} TON required). Please deposit funds to Treasury first.</span>
          </div>
        )}

        {/* Execution Progress */}
        {isExecuting && (
          <div className="bg-[#080d1a] p-4 rounded-xl border border-white/10 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0098EA]" />
                Auto-gassing wallets in progress...
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="flex-1 btn btn-secondary py-3 text-xs font-semibold"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleStartAutoGas}
            disabled={isExecuting || underfundedWallets.length === 0 || !hasSufficientTreasury}
            className="flex-1 btn btn-gold py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Zap className="w-4 h-4 text-black" />
            <span>Auto-Gas {underfundedWallets.length} Wallets</span>
          </button>
        </div>

      </div>
    </div>
  );
};
