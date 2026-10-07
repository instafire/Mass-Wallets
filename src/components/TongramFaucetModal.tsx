import React, { useState, useEffect, useRef } from 'react';
import type { ManagedWallet, Network } from '../types';
import confetti from 'canvas-confetti';
import { toNano } from '@ton/ton';
import { X, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface TongramFaucetModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network: Network;
  onFundWallets: (updatedWallets: ManagedWallet[], message: string) => void;
}

export const TongramFaucetModal: React.FC<TongramFaucetModalProps> = ({
  isOpen,
  onClose,
  wallets,
  network,
  onFundWallets,
}) => {
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');
  const [faucetAmount, setFaucetAmount] = useState<string>('5');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleClaimFaucet = () => {
    setIsProcessing(true);
    setSuccessMsg(null);

    timerRef.current = setTimeout(() => {
      const amountNum = parseFloat(faucetAmount) || 5;
      let targetWallets = [...wallets];

      targetWallets = targetWallets.map(w => {
        const isTarget = selectedWalletId === 'all' || w.id === selectedWalletId;
        if (!isTarget) return w;

        // Scoped specifically to testnet
        const currentTestnet = w.networkBalances?.testnet || {
          ton: '0.00',
          tonNano: '0',
          jettons: [],
        };

        const existingTon = parseFloat(currentTestnet.ton || '0');
        const updatedTestnetTon = (existingTon + amountNum).toFixed(4);
        let addedNano = BigInt(0);
        try {
          addedNano = toNano(amountNum.toString());
        } catch {
          addedNano = BigInt(Math.floor(amountNum * 1e9));
        }
        const updatedTestnetNano = (BigInt(currentTestnet.tonNano || '0') + addedNano).toString();

        const updatedTestnetBalances = {
          ton: updatedTestnetTon,
          tonNano: updatedTestnetNano,
          jettons: currentTestnet.jettons || [],
        };

        return {
          ...w,
          balance: network === 'testnet' ? updatedTestnetTon : w.balance,
          balanceNano: network === 'testnet' ? updatedTestnetNano : w.balanceNano,
          networkBalances: {
            mainnet: w.networkBalances?.mainnet || {
              ton: w.balance || '0.00',
              tonNano: w.balanceNano || '0',
              jettons: [],
            },
            testnet: updatedTestnetBalances,
          },
        };
      });

      setIsProcessing(false);
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
      const targetCount = selectedWalletId === 'all' ? wallets.length : 1;
      const msg = `Funded ${targetCount} wallet(s) with ${amountNum} Testnet TON!`;
      setSuccessMsg(msg);
      onFundWallets(targetWallets, msg);
    }, 600);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Testnet TON Faucet</h2>
              <p className="text-xs text-gray-400">Claim testnet TON gas coins for simulation & testing</p>
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
          
          {/* Notice */}
          <div className="bg-[#121b30] p-3.5 rounded-xl border border-white/10 flex items-start gap-2.5 text-xs text-gray-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              Faucet tokens are exclusively credited to the <strong>TON Testnet</strong> environment. Mainnet balances remain completely authentic and untouched.
            </p>
          </div>

          {/* Wallet Target Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Select Target Wallet:</label>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="input-field py-2 text-xs"
            >
              <option value="all">⚡ All Studio Wallets ({wallets.length} Wallets)</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  {w.label} ({w.address.substring(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Amount Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Amount to Claim:</label>
            <div className="flex gap-2">
              {['2', '5', '10', '25', '50'].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFaucetAmount(val)}
                  className={`tab-btn flex-1 py-2 text-xs font-bold ${
                    faucetAmount === val ? 'active-amber' : ''
                  }`}
                >
                  {val} TON
                </button>
              ))}
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Claim Button */}
          <div className="pt-2">
            <button
              onClick={handleClaimFaucet}
              disabled={isProcessing || wallets.length === 0}
              className="w-full btn btn-gold py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {isProcessing ? (
                <span>Crediting Testnet TON...</span>
              ) : (
                <>
                  <Zap className="w-5 h-5 text-black" />
                  <span>Claim {faucetAmount} Testnet TON</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
