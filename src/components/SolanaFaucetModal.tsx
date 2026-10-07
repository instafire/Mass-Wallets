import React, { useState, useMemo } from 'react';
import type { ManagedWallet, Network } from '../types';
import { SolanaService } from '../services/solanaService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Droplets, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Zap, 
  ShieldAlert
} from 'lucide-react';

interface SolanaFaucetModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network: Network;
  onAirdropCompleted: (updatedWallets: ManagedWallet[]) => void;
}

interface AirdropProgressItem {
  wallet: ManagedWallet;
  status: 'idle' | 'pending' | 'success' | 'failed';
  txHash?: string;
  error?: string;
}

export const SolanaFaucetModal: React.FC<SolanaFaucetModalProps> = ({
  isOpen,
  onClose,
  wallets,
  network,
  onAirdropCompleted,
}) => {
  const [targetGroup, setTargetGroup] = useState<'empty' | 'all' | 'custom'>('empty');
  const [airdropAmount, setAirdropAmount] = useState<number>(1);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [items, setItems] = useState<AirdropProgressItem[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);

  // Filter only Solana wallets
  const solanaWallets = useMemo(() => {
    return wallets.filter(w => w.chain === 'solana' || w.version === 'solana-ed25519' || w.version === 'squads-v4');
  }, [wallets]);

  const emptySolanaWallets = useMemo(() => {
    return solanaWallets.filter(w => parseFloat(w.balance || '0') <= 0);
  }, [solanaWallets]);

  // Determine current active target list
  const activeTargets = useMemo(() => {
    if (targetGroup === 'empty') return emptySolanaWallets;
    return solanaWallets;
  }, [targetGroup, emptySolanaWallets, solanaWallets]);

  if (!isOpen) return null;

  const handleStartAirdrop = async () => {
    if (activeTargets.length === 0 || isExecuting) return;

    setIsExecuting(true);
    setCompletedCount(0);

    const progressItems: AirdropProgressItem[] = activeTargets.map(w => ({
      wallet: w,
      status: 'idle',
    }));
    setItems(progressItems);

    const updatedWalletsMap = new Map<string, ManagedWallet>();
    let successCount = 0;

    for (let i = 0; i < progressItems.length; i++) {
      progressItems[i] = { ...progressItems[i], status: 'pending' };
      setItems([...progressItems]);

      const targetWallet = progressItems[i].wallet;
      try {
        const res = await SolanaService.requestAirdrop(targetWallet.address, airdropAmount, network);

        if (res.success && res.txHash) {
          const currentBal = parseFloat(targetWallet.balance || '0');
          const newBal = (currentBal + airdropAmount).toFixed(4);
          const updated: ManagedWallet = {
            ...targetWallet,
            balance: newBal,
            lastChecked: Date.now(),
            networkBalances: {
              ...targetWallet.networkBalances,
              [network]: {
                ton: newBal,
                tonNano: (parseFloat(targetWallet.balanceNano || '0') + airdropAmount * 1e9).toString(),
                jettons: targetWallet.jettons || [],
                nfts: targetWallet.nfts || [],
              },
            },
          };
          updatedWalletsMap.set(targetWallet.id, updated);

          progressItems[i] = {
            ...progressItems[i],
            status: 'success',
            txHash: res.txHash,
          };
          successCount++;
        } else {
          progressItems[i] = {
            ...progressItems[i],
            status: 'failed',
            error: res.error || 'Faucet rate limit exceeded',
          };
        }
      } catch (err: any) {
        progressItems[i] = {
          ...progressItems[i],
          status: 'failed',
          error: err?.message || 'Airdrop request failed',
        };
      }

      setCompletedCount(i + 1);
      setItems([...progressItems]);

      // Public Solana devnet faucets enforce rate limits; delay 1.5 seconds between requests
      if (i < progressItems.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsExecuting(false);

    if (successCount > 0) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      const mergedWallets = wallets.map(w => updatedWalletsMap.get(w.id) || w);
      onAirdropCompleted(mergedWallets);
    }
  };

  const isTestnet = network === 'testnet';

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !isExecuting) onClose(); }}
    >
      <div className="modal-content max-w-xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9945FF]/30 to-[#14F195]/20 border border-[#14F195]/30 text-[#14F195] flex items-center justify-center shadow-lg">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Solana Devnet Faucet Engine</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30">
                  DEVNET / TESTNET
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Request free test SOL directly to your studio wallets from the Solana blockchain
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network Warning if Mainnet */}
        {!isTestnet && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex items-start gap-3 my-4">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200">
              <span className="font-bold block text-amber-300">Currently on Solana Mainnet</span>
              Free airdrops are only available on Devnet and Testnet. Switch the active network in the top navigation bar to Testnet/Devnet to use the faucet engine.
            </div>
          </div>
        )}

        {/* Configuration Options */}
        <div className="space-y-4 my-4">
          
          {/* Target Group Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Select Wallets to Fund:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetGroup('empty')}
                disabled={isExecuting}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                  targetGroup === 'empty'
                    ? 'bg-[#14F195]/15 border-[#14F195] text-white shadow-md'
                    : 'bg-[#080d1a] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span>Only Empty Wallets</span>
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">
                    {emptySolanaWallets.length} wallets
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-normal">
                  Wallets with 0.00 SOL needing initial gas
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetGroup('all')}
                disabled={isExecuting}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                  targetGroup === 'all'
                    ? 'bg-[#9945FF]/20 border-[#9945FF] text-white shadow-md'
                    : 'bg-[#080d1a] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span>All Solana Wallets</span>
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">
                    {solanaWallets.length} wallets
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-normal">
                  Fund every managed Solana address in studio
                </p>
              </button>
            </div>
          </div>

          {/* Amount per wallet */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Amount per Airdrop Request:
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAirdropAmount(1)}
                disabled={isExecuting}
                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                  airdropAmount === 1
                    ? 'bg-[#14F195]/20 border-[#14F195] text-white'
                    : 'bg-[#080d1a] border-white/10 text-gray-400'
                }`}
              >
                1.0 SOL (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setAirdropAmount(2)}
                disabled={isExecuting}
                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                  airdropAmount === 2
                    ? 'bg-[#14F195]/20 border-[#14F195] text-white'
                    : 'bg-[#080d1a] border-white/10 text-gray-400'
                }`}
              >
                2.0 SOL (Devnet Max)
              </button>
            </div>
          </div>

          {/* Rate Limit Note */}
          <div className="bg-[#080d1a] p-3 rounded-xl border border-white/5 text-[11px] text-gray-400 space-y-1">
            <span className="font-semibold text-gray-300 block">⚡ Rate-Limiting Notice:</span>
            <p>
              Solana public Devnet nodes limit airdrops to prevent spam. Our batch engine automatically spaces requests by 1.5s to ensure maximum delivery success.
            </p>
          </div>

        </div>

        {/* Live Execution Progress */}
        {items.length > 0 && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-300">
                Airdrop Progress: {completedCount} / {items.length}
              </span>
              <span className="font-mono text-[#14F195]">
                {Math.round((completedCount / items.length) * 100)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#080d1a] rounded-full h-2 overflow-hidden border border-white/5">
              <div 
                className="bg-gradient-to-r from-[#9945FF] to-[#14F195] h-full transition-all duration-300"
                style={{ width: `${(completedCount / items.length) * 100}%` }}
              />
            </div>

            {/* Scrollable Items Log */}
            <div className="max-h-40 overflow-y-auto divide-y divide-white/5 bg-[#080d1a] rounded-xl border border-white/5 text-xs">
              {items.map((item) => (
                <div key={item.wallet.id} className="p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate pr-2">
                    {item.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {item.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    {item.status === 'pending' && <RefreshCw className="w-3.5 h-3.5 text-[#0098EA] animate-spin shrink-0" />}
                    {item.status === 'idle' && <div className="w-3.5 h-3.5 rounded-full bg-gray-700 shrink-0" />}
                    <span className="text-white font-medium truncate">{item.wallet.label}</span>
                    <span className="font-mono text-[10px] text-gray-400 truncate">
                      ({item.wallet.address.substring(0, 6)}...{item.wallet.address.substring(item.wallet.address.length - 4)})
                    </span>
                  </div>

                  <div className="shrink-0 font-mono text-[11px]">
                    {item.status === 'success' && (
                      <span className="text-emerald-400 font-bold">+{airdropAmount} SOL</span>
                    )}
                    {item.status === 'failed' && (
                      <span className="text-red-400 text-[10px]">{item.error || 'Failed'}</span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-[#0098EA]">Requesting...</span>
                    )}
                    {item.status === 'idle' && (
                      <span className="text-gray-500">Queued</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="btn btn-secondary btn-sm px-4"
          >
            {completedCount > 0 ? 'Close' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleStartAirdrop}
            disabled={!isTestnet || activeTargets.length === 0 || isExecuting}
            className="btn btn-primary btn-sm px-5 bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-[#14F195]/20 disabled:opacity-40"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Distributing Test SOL...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Airdrop {airdropAmount} SOL to {activeTargets.length} Wallets</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
