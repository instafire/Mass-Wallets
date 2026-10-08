import React, { useState, useEffect, useMemo } from 'react';
import type { ManagedWallet, Network } from '../types';
import { isSolanaWallet } from '../types';
import { TonService, SUPPORTED_JETTONS } from '../services/tonService';
import { SolanaService, SOLANA_BASE_TX_FEE_SOL, SOLANA_ATA_RENT_SOL } from '../services/solanaService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Send, 
  Crown, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert,
  Copy, 
  Check, 
  Fuel, 
  ArrowRight,
  Zap,
  Info
} from 'lucide-react';

interface MainWalletDistributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mainWallet: ManagedWallet | null;
  recipientWallets: ManagedWallet[];
  network: Network;
  initialToken?: string;
  onDistributionComplete: () => void;
}

export const MainWalletDistributeModal: React.FC<MainWalletDistributeModalProps> = ({
  isOpen,
  onClose,
  mainWallet,
  recipientWallets,
  network,
  initialToken,
  onDistributionComplete,
}) => {
  const isSolana = isSolanaWallet(mainWallet);
  const [selectedToken, setSelectedToken] = useState<string>(isSolana ? 'SOL' : 'TON');
  const [distributionMode, setDistributionMode] = useState<'per-wallet' | 'total-pool'>('per-wallet');
  const [perWalletAmount, setPerWalletAmount] = useState<string>(isSolana ? '0.05' : '0.2');
  const [totalPoolAmount, setTotalPoolAmount] = useState<string>(isSolana ? '1.0' : '1.0');
  const [comment, setComment] = useState<string>('Treasury Distribution');
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);

  // Gas Optimization Tier State
  const [gasTier, setGasTier] = useState<'eco' | 'standard' | 'high' | 'custom'>('eco');
  const [customGasInput, setCustomGasInput] = useState<string>('0.010');
  
  // Execution State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Strictly filter to secondary tokens held with positive balance by main treasury
  const heldSecondaryTokens = useMemo(() => {
    if (!mainWallet?.jettons) return [];
    const nativeSymbol = isSolana ? 'SOL' : 'TON';
    return mainWallet.jettons.filter(j => 
      j.symbol.toUpperCase() !== nativeSymbol && parseFloat(j.balance || '0') > 0
    );
  }, [mainWallet, isSolana]);

  useEffect(() => {
    if (initialToken) {
      setSelectedToken(initialToken);
    }
  }, [initialToken, isOpen]);

  useEffect(() => {
    const nativeSym = isSolana ? 'SOL' : 'TON';
    if (selectedToken !== nativeSym && !heldSecondaryTokens.some(t => t.symbol.toUpperCase() === selectedToken.toUpperCase())) {
      setSelectedToken(nativeSym);
    }
  }, [heldSecondaryTokens, isSolana, selectedToken]);

  if (!isOpen || !mainWallet) return null;

  // Filter out main wallet from recipients list if present
  const validRecipients = recipientWallets.filter(w => w.id !== mainWallet.id);
  const totalRecipientsCount = validRecipients.length;

  // Compute amounts
  let calculatedPerWallet = 0;
  let calculatedTotalAsset = 0;

  if (distributionMode === 'per-wallet') {
    calculatedPerWallet = parseFloat(perWalletAmount) || 0;
    calculatedTotalAsset = calculatedPerWallet * totalRecipientsCount;
  } else {
    calculatedTotalAsset = parseFloat(totalPoolAmount) || 0;
    calculatedPerWallet = totalRecipientsCount > 0 ? calculatedTotalAsset / totalRecipientsCount : 0;
  }

  // Realistic & Optimized Gas Fee Calculation
  let minFeePerTx = isSolana ? 0.000005 : 0.002;
  let attachedTokenGas = '0.010';
  let forwardTokenAmount = '0.0002';

  if (!isSolana) {
    if (selectedToken === 'TON') {
      if (gasTier === 'eco') minFeePerTx = 0.002;
      else if (gasTier === 'standard') minFeePerTx = 0.0035;
      else if (gasTier === 'high') minFeePerTx = 0.005;
      else minFeePerTx = Math.max(0.001, parseFloat(customGasInput) || 0.002);
    } else {
      if (gasTier === 'eco') {
        minFeePerTx = 0.010;
        attachedTokenGas = '0.010';
        forwardTokenAmount = '0.0002';
      } else if (gasTier === 'standard') {
        minFeePerTx = 0.015;
        attachedTokenGas = '0.015';
        forwardTokenAmount = '0.0005';
      } else if (gasTier === 'high') {
        minFeePerTx = 0.025;
        attachedTokenGas = '0.025';
        forwardTokenAmount = '0.001';
      } else {
        minFeePerTx = Math.max(0.005, parseFloat(customGasInput) || 0.010);
        attachedTokenGas = minFeePerTx.toFixed(4);
        forwardTokenAmount = '0.0002';
      }
    }
  }

  const isNativeToken = isSolana ? selectedToken === 'SOL' : selectedToken === 'TON';

  // Solana fee mechanics:
  // 1. Signature base fee: 5,000 lamports = 0.000005 SOL per transfer
  // 2. Associated Token Account (ATA) rent-exempt deposit: 2,039,280 lamports = 0.00203928 SOL
  //    Required for any recipient who does not already hold this SPL token on-chain.
  const solanaAtaNeededCount = (!isSolana || isNativeToken) 
    ? 0 
    : validRecipients.filter(w => {
        const jettons = w.jettons || [];
        const hasToken = jettons.some(j => j.symbol.toUpperCase() === selectedToken.toUpperCase());
        return !hasToken;
      }).length;

  const solanaBaseTxCost = totalRecipientsCount * SOLANA_BASE_TX_FEE_SOL;
  const solanaAtaRentCost = solanaAtaNeededCount * SOLANA_ATA_RENT_SOL;
  const solanaTotalGasFee = solanaBaseTxCost + solanaAtaRentCost;

  const totalGasFeeRequired = isSolana ? solanaTotalGasFee : (totalRecipientsCount * minFeePerTx);

  // Total Native Vault MUST hold to execute:
  const totalNativeRequiredInVault = isNativeToken 
    ? (calculatedTotalAsset + totalGasFeeRequired)
    : totalGasFeeRequired;

  // Main Treasury current balances
  const mainNativeBalance = parseFloat(mainWallet.balance || '0');
  const matchedToken = mainWallet.jettons?.find(j => j.symbol === selectedToken);
  const mainTokenBalance = isNativeToken ? mainNativeBalance : (matchedToken ? parseFloat(matchedToken.balance || '0') : 0);

  // Deficits
  const nativeDeficit = Math.max(0, totalNativeRequiredInVault - mainNativeBalance);
  const tokenDeficit = !isNativeToken ? Math.max(0, calculatedTotalAsset - mainTokenBalance) : 0;

  const hasEnoughNativeForGas = mainNativeBalance >= totalGasFeeRequired;
  const hasEnoughAsset = isNativeToken 
    ? mainNativeBalance >= totalNativeRequiredInVault
    : mainTokenBalance >= calculatedTotalAsset;

  const isFormValid = calculatedPerWallet > 0 && totalRecipientsCount > 0 && hasEnoughAsset && hasEnoughNativeForGas;

  const handleCopyDepositAddress = () => {
    navigator.clipboard.writeText(mainWallet.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleStartDistribution = async () => {
    if (!isFormValid) return;

    setIsExecuting(true);
    setExecutionProgress({ current: 0, total: totalRecipientsCount });

    let successCount = 0;
    const tokenDecimals = isSolana 
      ? 4 
      : (selectedToken === 'TON' ? 4 : (SUPPORTED_JETTONS.find(t => t.symbol === selectedToken)?.decimals === 6 ? 2 : 4));

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];
      setExecutionProgress({ current: i + 1, total: totalRecipientsCount });

      try {
        if (isSolana) {
          let res;
          if (selectedToken === 'SOL') {
            res = await SolanaService.sendSol(
              mainWallet,
              recipient.address,
              calculatedPerWallet.toFixed(4),
              network
            );
          } else {
            res = await SolanaService.sendSplToken(
              mainWallet,
              recipient.address,
              selectedToken,
              calculatedPerWallet.toFixed(4),
              network
            );
          }
          if (res.success) {
            successCount++;
          }
        } else {
          const res = await TonService.sendTransaction(
            mainWallet,
            recipient.address,
            calculatedPerWallet.toFixed(tokenDecimals),
            comment || 'Treasury Distribution',
            network,
            selectedToken,
            attachedTokenGas,
            forwardTokenAmount
          );
          if (res.success) {
            successCount++;
          }
        }
      } catch (err: any) {
        console.error('Distribution send error:', err);
      }

      // Small throttle yield to avoid RPC flood
      if (i < validRecipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }

    setIsExecuting(false);
    if (successCount > 0) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    }
    onDistributionComplete();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl max-h-[92vh] overflow-y-auto p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-md shadow-amber-500/10">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">Vault Mass Distribution</h2>
                <span className="badge badge-gold">Auto-Disperse</span>
              </div>
              <p className="text-xs text-gray-400">
                Distribute tokens from Master Vault to all {totalRecipientsCount} studio wallets
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

        <div className="py-5 space-y-5">
          
            {/* Asset Selection Tabs */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Select Asset to Distribute:</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedToken(isSolana ? 'SOL' : 'TON')}
                className={`tab-btn flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-bold ${
                  selectedToken === (isSolana ? 'SOL' : 'TON') ? 'active-primary' : ''
                }`}
              >
                <span>{isSolana ? '🟣' : '💎'}</span>
                <span>{isSolana ? 'SOL' : 'TON'}</span>
              </button>

              {heldSecondaryTokens.map(s => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => setSelectedToken(s.symbol)}
                  className={`tab-btn flex items-center justify-center gap-1 py-2.5 px-4 text-xs font-bold ${
                    selectedToken.toUpperCase() === s.symbol.toUpperCase() ? 'active-amber' : ''
                  }`}
                  title={`${s.balance} ${s.symbol}`}
                >
                  <span>{s.icon || '🪙'}</span>
                  <span>{s.symbol}</span>
                  <span className="text-[10px] text-gray-400 font-mono ml-0.5">({s.balance})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Distribution Mode & Input */}
          <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 space-y-4">
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Distribution Method:</span>
              <div className="flex bg-[#121b30] p-1 rounded-xl border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => setDistributionMode('per-wallet')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    distributionMode === 'per-wallet' ? 'bg-[#0098EA] text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Amount per Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionMode('total-pool')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    distributionMode === 'total-pool' ? 'bg-[#0098EA] text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Split Total Pool
                </button>
              </div>
            </div>

            {distributionMode === 'per-wallet' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Amount Each Wallet Will Receive ({selectedToken}):
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['0.05', '0.1', '0.2', '0.5'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPerWalletAmount(val)}
                      className={`tab-btn py-1.5 text-xs font-bold ${perWalletAmount === val ? 'active-primary' : ''}`}
                    >
                      {val} {selectedToken}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={perWalletAmount}
                  onChange={(e) => setPerWalletAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-field py-2.5 text-sm font-bold"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Total Pool to Split Across All {totalRecipientsCount} Wallets ({selectedToken}):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={totalPoolAmount}
                  onChange={(e) => setTotalPoolAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-field py-2.5 text-sm font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Memo / Transfer Comment:</label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Studio Allocation"
                className="input-field py-2 text-xs"
              />
            </div>

          </div>

          {/* GAS OPTIMIZATION ENGINE & GAS TIER SELECTOR */}
          {isSolana ? (
            <div className="bg-[#080d1a] p-4 rounded-2xl border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Solana Network Fees & Rent Breakdown:</span>
                </div>
                <span className="text-xs text-[#14F195] font-bold font-mono">
                  ~{solanaTotalGasFee.toFixed(6)} SOL total
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#121b30] p-2.5 rounded-xl border border-white/5">
                  <span className="text-gray-400 block mb-0.5">Base Signature Fees:</span>
                  <span className="text-white font-mono font-bold block">
                    {solanaBaseTxCost.toFixed(6)} SOL
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {totalRecipientsCount} txs × 0.000005 SOL
                  </span>
                </div>

                <div className="bg-[#121b30] p-2.5 rounded-xl border border-white/5">
                  <span className="text-gray-400 block mb-0.5">ATA Rent-Exempt Deposits:</span>
                  <span className="text-[#14F195] font-mono font-bold block">
                    {solanaAtaRentCost > 0 ? `${solanaAtaRentCost.toFixed(6)} SOL` : '0 SOL (Native SOL)'}
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {solanaAtaNeededCount > 0 ? `${solanaAtaNeededCount} uninitialized ATAs × 0.00204 SOL` : 'All recipients ATA ready'}
                  </span>
                </div>
              </div>

              {!isNativeToken && (
                <div className="flex items-start gap-1.5 text-[10px] text-gray-400 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                  <Info className="w-3 h-3 text-purple-300 shrink-0 mt-0.5" />
                  <span>
                    Solana requires a 0.00203928 SOL rent-exempt deposit for any wallet receiving {selectedToken} for the first time to allocate a 165-byte Associated Token Account (ATA).
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Gas Optimization Engine:</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-bold font-mono">
                  {minFeePerTx} TON / tx
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setGasTier('eco')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    gasTier === 'eco'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-md'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-xs">⚡ Ultra-Eco</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Low</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block">
                    {selectedToken === 'TON' ? '0.002 TON' : '0.010 TON'} / wallet
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGasTier('standard')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    gasTier === 'standard'
                      ? 'bg-[#0098EA]/15 border-[#0098EA]/50 text-[#0098EA] shadow-md'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-xs">🚀 Standard</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block">
                    {selectedToken === 'TON' ? '0.0035 TON' : '0.015 TON'} / wallet
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGasTier('high')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    gasTier === 'high'
                      ? 'bg-purple-500/15 border-purple-500/50 text-purple-300 shadow-md'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-xs">🛡️ High Priority</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block">
                    {selectedToken === 'TON' ? '0.005 TON' : '0.025 TON'} / wallet
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGasTier('custom')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    gasTier === 'custom'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-md'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-xs">⚙️ Custom</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block">Set exact gas</span>
                </button>
              </div>

              {gasTier === 'custom' && (
                <div className="pt-2 animate-fadeIn">
                  <label className="block text-[11px] text-gray-400 mb-1">Custom Attached Gas per Tx (TON):</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={customGasInput}
                    onChange={(e) => setCustomGasInput(e.target.value)}
                    placeholder="0.010"
                    className="input-field py-1.5 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* EXACT VAULT REQUIREMENTS & FUNDING BREAKDOWN */}
          <div className="bg-[#121b30] p-4 rounded-2xl border border-amber-500/40 space-y-3.5 shadow-lg shadow-amber-500/5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-amber-400" />
                <span>Optimized Vault Funding & Gas Breakdown</span>
              </h4>
              <span className="badge badge-gold text-[10px]">
                {totalRecipientsCount} Recipients
              </span>
            </div>

            {/* 4-Stat Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              
              <div className="bg-[#080d1a] p-3 rounded-xl border border-white/5">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Token to Send:</span>
                <span className="text-sm font-black text-white font-mono">
                  {calculatedTotalAsset.toFixed(isNativeToken ? 4 : 2)} {selectedToken}
                </span>
                <span className="text-[10px] text-gray-500 block">
                  ({calculatedPerWallet.toFixed(3)}/wallet)
                </span>
              </div>

              <div className="bg-[#080d1a] p-3 rounded-xl border border-white/5">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Total Network Gas:</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  ~{totalGasFeeRequired.toFixed(isSolana ? 6 : 3)} {isSolana ? 'SOL' : 'TON'}
                </span>
                <span className="text-[10px] text-gray-500 block">
                  {isSolana 
                    ? `(${totalRecipientsCount} txs${solanaAtaNeededCount > 0 ? ` + ${solanaAtaNeededCount} ATAs` : ''})` 
                    : `(${minFeePerTx} TON × ${totalRecipientsCount})`}
                </span>
              </div>

              <div className="bg-[#080d1a] p-3 rounded-xl border border-[#0098EA]/30">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Total {isSolana ? 'SOL' : 'TON'} Vault Needs:</span>
                <span className="text-base font-black text-[#0098EA] font-mono">
                  {totalNativeRequiredInVault.toFixed(isSolana ? 5 : 4)} {isSolana ? 'SOL' : 'TON'}
                </span>
                <span className="text-[10px] text-gray-400 block">
                  {isNativeToken ? 'Asset + Gas' : 'Gas Only'}
                </span>
              </div>

              <div className="bg-[#080d1a] p-3 rounded-xl border border-emerald-500/30">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Vault Current {isSolana ? 'SOL' : 'TON'}:</span>
                <span className={`text-base font-black font-mono ${mainNativeBalance >= totalNativeRequiredInVault ? 'text-emerald-400' : 'text-red-400'}`}>
                  {mainNativeBalance.toFixed(isSolana ? 4 : 2)} {isSolana ? 'SOL' : 'TON'}
                </span>
                {!isNativeToken && (
                  <span className="text-[10px] text-amber-400 block truncate">
                    ({mainTokenBalance} {selectedToken})
                  </span>
                )}
              </div>

            </div>

            {/* Live Vault Readiness Status Banner */}
            {hasEnoughAsset && hasEnoughNativeForGas ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Vault is ready!</strong> You have sufficient {isSolana ? 'SOL' : 'TON'} for all {totalRecipientsCount} transactions.
                  </span>
                </div>
                <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Ready</span>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-2 text-xs text-red-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span>
                      <strong>Vault Needs Top-up:</strong> Deposit <strong>+{nativeDeficit.toFixed(isSolana ? 5 : 4)} {isSolana ? 'SOL' : 'TON'}</strong> 
                      {tokenDeficit > 0 && ` and +${tokenDeficit.toFixed(2)} ${selectedToken}`} to proceed.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyDepositAddress}
                    className="btn btn-secondary btn-sm py-1 px-2 text-[11px] text-gray-200 hover:text-white flex items-center gap-1 shrink-0"
                  >
                    {copiedAddr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAddr ? 'Copied' : 'Copy Address'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-red-300/80 font-mono break-all bg-[#080d1a] p-2 rounded-lg border border-red-500/20">
                  Deposit to: {mainWallet.address}
                </p>
              </div>
            )}

          </div>

          {/* Live Execution Progress Bar */}
          {isExecuting && (
            <div className="space-y-3 bg-[#080d1a] p-4 rounded-xl border border-[#0098EA]/30 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0098EA] animate-spin" />
                  Broadcasting Transactions...
                </span>
                <span className="font-mono text-[#0098EA] font-bold">
                  {executionProgress.current} / {executionProgress.total} Wallets Funded
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#0098EA] to-emerald-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(executionProgress.current / executionProgress.total) * 100}%` }}
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
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartDistribution}
              disabled={!isFormValid || isExecuting}
              className="flex-1 btn btn-gold py-3 text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Send className="w-4 h-4" />
              <span>Execute Mass Distribution ({totalRecipientsCount} Wallets)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
