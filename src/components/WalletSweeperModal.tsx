import React, { useState } from 'react';
import type { ManagedWallet, Network } from '../types';
import { TonService, SUPPORTED_JETTONS } from '../services/tonService';
import { SolanaService } from '../services/solanaService';
import confetti from 'canvas-confetti';
import { 
  X, 
  ArrowDownToLine, 
  Crown, 
  RefreshCw, 
  CheckCircle2, 
  Coins 
} from 'lucide-react';

interface WalletSweeperModalProps {
  isOpen: boolean;
  onClose: () => void;
  mainWallet: ManagedWallet | null;
  allWallets: ManagedWallet[];
  sourceWallets?: ManagedWallet[];
  network: Network;
  onSweepComplete: () => void;
}

export const WalletSweeperModal: React.FC<WalletSweeperModalProps> = ({
  isOpen,
  onClose,
  mainWallet,
  allWallets,
  sourceWallets,
  network,
  onSweepComplete,
}) => {
  const [selectedToken, setSelectedToken] = useState<string>('TON');
  const [sweepChain, setSweepChain] = useState<'ton' | 'solana'>('ton');
  const [solDestinationId, setSolDestinationId] = useState<string>('');
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [statuses, setStatuses] = useState<Record<string, { status: 'pending' | 'success' | 'failed'; txHash?: string; error?: string }>>({});

  if (!isOpen || !mainWallet) return null;

  const isSolanaMode = sweepChain === 'solana';
  const solanaWallets = allWallets.filter(w => w.chain === 'solana');
  // Sweep destination: the designated treasury if it's on the sweep chain,
  // otherwise an explicit pick (never silently send to a wrong-chain wallet).
  const sweepDestination: ManagedWallet | null = isSolanaMode
    ? (solanaWallets.find(w => w.id === (solDestinationId || (mainWallet.chain === 'solana' ? mainWallet.id : ''))) || null)
    : mainWallet;

  const candidateWallets = (sourceWallets && sourceWallets.length > 0 ? sourceWallets : allWallets)
    // Chain filter: TON sweeps use TON wallets, Solana sweeps use Solana wallets.
    // Mixing chains feeds a Solana mnemonic into the TON signer (or vice versa).
    .filter(w => isSolanaMode ? w.chain === 'solana' : (!w.chain || w.chain === 'ton'))
    .filter(w => !sweepDestination || w.id !== sweepDestination.id);
  // Reserve must cover the real on-chain fee. TON ~0.0104–0.02; Solana 0.000005.
  const minFee = isSolanaMode ? 0.00001 : (selectedToken === 'TON' ? 0.02 : 0.05);

  // Find all funded sub-wallets (excluding the sweep destination)
  const sweepableWallets = candidateWallets
    .map(w => {
      const nativeBal = parseFloat(w.balance || '0');
      const jetton = !isSolanaMode ? w.jettons?.find(j => j.symbol === selectedToken) : undefined;
      const jettonBal = jetton ? parseFloat(jetton.balance || '0') : 0;

      let sweepAmount = 0;
      if (isSolanaMode || selectedToken === 'TON') {
        sweepAmount = Math.max(0, nativeBal - minFee);
      } else {
        sweepAmount = nativeBal >= minFee ? jettonBal : 0; // needs gas to transfer jetton
      }

      return {
        wallet: w,
        tonBal: nativeBal,
        jettonBal,
        sweepAmount,
        canSweep: sweepAmount > 0 && (isSolanaMode || selectedToken === 'TON' || nativeBal >= minFee),
      };
    })
    .filter(item => item.canSweep);

  const totalSweepableAsset = sweepableWallets.reduce((sum, item) => sum + item.sweepAmount, 0);
  const sweepAssetLabel = isSolanaMode ? 'SOL' : selectedToken;

  const handleStartSweep = async () => {
    if (sweepableWallets.length === 0 || !sweepDestination) return;

    setIsSweeping(true);
    setSweepProgress({ current: 0, total: sweepableWallets.length });
    const currentStatuses: Record<string, { status: 'pending' | 'success' | 'failed'; txHash?: string; error?: string }> = {};
    let successCount = 0;
    const tokenDecimals = isSolanaMode ? 4 : (selectedToken === 'TON' ? 4 : (SUPPORTED_JETTONS.find(t => t.symbol === selectedToken)?.decimals === 6 ? 2 : 4));

    for (let i = 0; i < sweepableWallets.length; i++) {
      const item = sweepableWallets[i];
      currentStatuses[item.wallet.id] = { status: 'pending' };
      setStatuses({ ...currentStatuses });
      setSweepProgress({ current: i + 1, total: sweepableWallets.length });

      try {
        const res = isSolanaMode
          ? await SolanaService.sendSol(
              item.wallet,
              sweepDestination.address,
              item.sweepAmount.toFixed(tokenDecimals),
              network
            )
          : await TonService.sendTransaction(
              item.wallet,
              sweepDestination.address,
              item.sweepAmount.toFixed(tokenDecimals),
              'Treasury Consolidation Sweep',
              network,
              selectedToken
            );

        if (res.success) {
          currentStatuses[item.wallet.id] = { status: 'success', txHash: res.txHash };
          successCount++;
        } else {
          currentStatuses[item.wallet.id] = { status: 'failed', error: res.error };
        }
      } catch (err: any) {
        currentStatuses[item.wallet.id] = { status: 'failed', error: err?.message || 'Sweep error' };
      }

      setStatuses({ ...currentStatuses });

      if (i < sweepableWallets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }

    setIsSweeping(false);
    if (successCount > 0) {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
    onSweepComplete();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center border border-[#0098EA]/30">
              <ArrowDownToLine className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Consolidate & Sweep Balances</h2>
                <span className="badge badge-primary">Auto-Gather</span>
              </div>
              <p className="text-xs text-gray-400">
                Gather all funds from sub-wallets back into the Master Treasury Wallet
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSweeping}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">

          {/* Chain Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Sweep Chain:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSweepChain('ton')}
                className={`tab-btn py-2.5 text-xs font-bold ${!isSolanaMode ? 'active-primary' : ''}`}
              >
                💎 TON
              </button>
              <button
                type="button"
                onClick={() => setSweepChain('solana')}
                className={`tab-btn py-2.5 text-xs font-bold ${isSolanaMode ? 'active-purple' : ''}`}
                disabled={solanaWallets.length === 0}
                title={solanaWallets.length === 0 ? 'No Solana wallets in the studio' : 'Sweep SOL'}
              >
                🟣 Solana {solanaWallets.length > 0 && `(${solanaWallets.length})`}
              </button>
            </div>
          </div>

          {/* Asset Selector (TON mode only — Solana mode sweeps native SOL) */}
          {!isSolanaMode && (
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Select Asset to Sweep:</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => setSelectedToken('TON')}
                className={`tab-btn flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold ${
                  selectedToken === 'TON' ? 'active-primary' : ''
                }`}
              >
                <span>💎</span>
                <span>TON</span>
              </button>

              {SUPPORTED_JETTONS.map(j => (
                <button
                  key={j.symbol}
                  type="button"
                  onClick={() => setSelectedToken(j.symbol)}
                  className={`tab-btn flex items-center justify-center gap-1 py-2.5 text-xs font-bold ${
                    selectedToken === j.symbol ? 'active-amber' : ''
                  }`}
                >
                  <span>{j.icon}</span>
                  <span>{j.symbol}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Treasury Destination Info */}
          <div className="bg-[#080d1a] p-3.5 rounded-xl border border-white/10 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-gray-300 font-semibold">Sweep Destination:</span>
                <span className="text-white font-bold">{sweepDestination ? sweepDestination.label : '—'}</span>
              </div>
              <span className="font-mono text-gray-400">{sweepDestination ? sweepDestination.address.substring(0, 10) + '...' : ''}</span>
            </div>
            {isSolanaMode && solanaWallets.length > 0 && (
              <select
                value={solDestinationId || (mainWallet.chain === 'solana' ? mainWallet.id : '')}
                onChange={(e) => setSolDestinationId(e.target.value)}
                className="input-field mt-2 py-1.5 px-2 text-xs w-full"
              >
                <option value="">Select Solana destination wallet…</option>
                {solanaWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.label} — {w.address.substring(0, 8)}...</option>
                ))}
              </select>
            )}
          </div>

          {/* Sweep Summary Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#121b30] p-4 rounded-xl border border-white/5">
              <span className="text-gray-400 block mb-1">Funded Wallets to Sweep:</span>
              <span className="text-xl font-bold text-white font-mono">{sweepableWallets.length} Wallets</span>
            </div>

            <div className="bg-[#121b30] p-4 rounded-xl border border-emerald-500/30">
              <span className="text-gray-400 block mb-1">Total Sweepable {sweepAssetLabel}:</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">
                {totalSweepableAsset.toFixed(isSolanaMode || sweepAssetLabel === 'TON' ? 4 : 2)} {sweepAssetLabel}
              </span>
            </div>
          </div>

          {sweepableWallets.length === 0 ? (
            <div className="bg-[#080d1a] p-6 rounded-xl border border-white/10 text-center space-y-2">
              <Coins className="w-8 h-8 text-gray-500 mx-auto" />
              <p className="text-sm font-bold text-gray-300">No Funded Sub-Wallets Found</p>
              <p className="text-xs text-gray-500">
                None of your sub-wallets currently have available {sweepAssetLabel} above minimum gas fees to sweep.
              </p>
            </div>
          ) : (
            /* Sweepable Wallets List */
            <div className="max-h-48 overflow-y-auto space-y-2 border border-white/10 rounded-xl bg-[#080d1a] p-2 divide-y divide-white/5">
              {sweepableWallets.map(({ wallet, sweepAmount }) => {
                const stat = statuses[wallet.id];
                return (
                  <div key={wallet.id} className="p-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{wallet.label}</span>
                      <span className="font-mono text-[10px] text-gray-400">{wallet.address.substring(0, 8)}...</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-emerald-400">
                        +{sweepAmount.toFixed(isSolanaMode || sweepAssetLabel === 'TON' ? 4 : 2)} {sweepAssetLabel}
                      </span>
                      {stat?.status === 'pending' && <span className="text-amber-400 animate-pulse">Sweeping...</span>}
                      {stat?.status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Swept</span>}
                      {stat?.status === 'failed' && <span className="text-red-400">Failed</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleStartSweep}
              disabled={isSweeping || sweepableWallets.length === 0 || !sweepDestination}
              className="w-full btn btn-primary py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#0098EA]/30"
            >
              {isSweeping ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Sweeping Balances ({sweepProgress.current}/{sweepProgress.total})...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ArrowDownToLine className="w-5 h-5" />
                  Sweep {totalSweepableAsset.toFixed(2)} {sweepAssetLabel} to {sweepDestination ? sweepDestination.label : '…'}
                </span>
              )}
            </button>
            {isSolanaMode && !sweepDestination && (
              <p className="text-[11px] text-amber-400 mt-2 text-center">Select a Solana destination wallet above to enable sweeping.</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
