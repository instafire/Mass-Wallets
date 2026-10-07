import React, { useState, useEffect } from 'react';
import type { ManagedWallet, Network } from '../types';
import { TonService, SUPPORTED_JETTONS } from '../services/tonService';
import { SolanaService, SUPPORTED_SOLANA_TOKENS } from '../services/solanaService';
import confetti from 'canvas-confetti';
import { X, Send, Smartphone, AlertCircle, CheckCircle2, ExternalLink, Lock } from 'lucide-react';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderWallet: ManagedWallet | null;
  allWallets: ManagedWallet[];
  network: Network;
  initialRecipient?: string;
  onTxSent: () => void;
}

export const SendModal: React.FC<SendModalProps> = ({
  isOpen,
  onClose,
  senderWallet,
  allWallets,
  network,
  initialRecipient = '',
  onTxSent,
}) => {
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('TON');
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txResult, setTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  useEffect(() => {
    if (senderWallet) {
      setSelectedWalletId(senderWallet.id);
    } else if (allWallets.length > 0) {
      setSelectedWalletId(allWallets[0].id);
    }
  }, [senderWallet, allWallets]);

  useEffect(() => {
    if (isOpen) {
      if (initialRecipient) {
        setRecipient(initialRecipient);
      }
      setTxResult(null);
    }
  }, [isOpen, initialRecipient]);

  if (!isOpen) return null;

  const currentWallet = allWallets.find(w => w.id === selectedWalletId) || senderWallet;
  const isSolana = currentWallet?.chain === 'solana' || currentWallet?.version === 'solana-ed25519' || currentWallet?.version === 'squads-v4';

  useEffect(() => {
    if (isSolana && selectedToken === 'TON') {
      setSelectedToken('SOL');
    } else if (!isSolana && selectedToken === 'SOL') {
      setSelectedToken('TON');
    }
  }, [isSolana]);

  const isAddressValid = recipient.trim() !== '' && (isSolana ? SolanaService.isValidAddress(recipient.trim()) : TonService.isValidAddress(recipient.trim()));
  const balanceNum = currentWallet ? parseFloat(currentWallet.balance || '0') : 0;
  const amountNum = parseFloat(amount || '0');

  const selectedJetton = (!isSolana && selectedToken !== 'TON') 
    ? currentWallet?.jettons?.find(j => j.symbol === selectedToken) 
    : (isSolana && selectedToken !== 'SOL') 
      ? currentWallet?.jettons?.find(j => j.symbol === selectedToken)
      : null;

  const jettonBal = selectedJetton ? parseFloat(selectedJetton.balance || '0') : 0;
  // Real TON transfer fees run ~0.0104–0.02; jetton transfers attach ~0.012 +
  // forward gas on top. The old floors (0.005 / 0.015) produced failing txs.
  const minGasRequired = isSolana ? 0.000005 : (selectedToken === 'TON' ? 0.02 : 0.05);

  const isAmountValid = amountNum > 0 && (
    (isSolana ? selectedToken === 'SOL' : selectedToken === 'TON')
      ? (amountNum + minGasRequired <= balanceNum)
      : (amountNum <= jettonBal && balanceNum >= minGasRequired)
  );

  const minNetworkFee = isSolana ? '0.000005 SOL' : (selectedToken === 'TON' ? '0.02 TON' : '0.05 TON');

  const handleMaxAmount = () => {
    if (!currentWallet) return;
    if (isSolana) {
      if (selectedToken === 'SOL') {
        const max = Math.max(0, balanceNum - 0.00001);
        setAmount(max.toFixed(4));
      } else {
        const token = currentWallet.jettons?.find(j => j.symbol === selectedToken);
        setAmount(token ? token.balance : '0');
      }
    } else {
      if (selectedToken === 'TON') {
        const max = Math.max(0, balanceNum - 0.02);
        setAmount(max.toFixed(4));
      } else {
        const jetton = currentWallet.jettons?.find(j => j.symbol === selectedToken);
        setAmount(jetton ? jetton.balance : '0');
      }
    }
  };

  const handleSendDirect = async () => {
    if (!currentWallet || !isAddressValid || !isAmountValid) return;

    setIsSending(true);
    setTxResult(null);

    try {
      if (isSolana) {
        if (selectedToken === 'SOL') {
          const res = await SolanaService.sendSol(
            currentWallet,
            recipient.trim(),
            amount.trim(),
            network
          );
          setTxResult(res);
          if (res.success) {
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
            onTxSent();
          }
        } else {
          const res = await SolanaService.sendSplToken(
            currentWallet,
            recipient.trim(),
            selectedToken,
            amount.trim(),
            network
          );
          setTxResult(res);
          if (res.success) {
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
            onTxSent();
          }
        }
      } else {
        const res = await TonService.sendTransaction(
          currentWallet,
          recipient.trim(),
          amount.trim(),
          comment.trim(),
          network,
          selectedToken
        );

        setTxResult(res);
        if (res.success) {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          onTxSent();
        }
      }
    } catch (err: any) {
      setTxResult({ success: false, error: err?.message || 'Transaction error' });
    } finally {
      setIsSending(false);
    }
  };

  const matchedJetton = SUPPORTED_JETTONS.find(j => j.symbol === selectedToken);
  const { webUrl } = (!isSolana && currentWallet)
    ? TonService.getTonkeeperDeepLink(recipient || currentWallet.address, amount, comment, matchedJetton?.masterAddress, matchedJetton?.decimals ?? 9)
    : { webUrl: '#' };

  const solscanUrl = currentWallet
    ? (txResult?.txHash
        ? `https://solscan.io/tx/${txResult.txHash}${network === 'testnet' ? '?cluster=devnet' : ''}`
        : `https://solscan.io/account/${recipient.trim() || currentWallet.address}${network === 'testnet' ? '?cluster=devnet' : ''}`)
    : '#';

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSolana ? 'bg-purple-500/20 text-purple-400' : 'bg-[#0098EA]/20 text-[#0098EA]'
            }`}>
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isSolana ? 'Send Solana Transaction' : 'Send TON Transaction'}
              </h2>
              <p className="text-xs text-gray-400">
                Network Fee: {minNetworkFee}
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

        <div className="py-5 space-y-4">
          
          {/* Sender Wallet Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Select Source Wallet:</label>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="input-field py-2.5 text-xs font-bold"
            >
              {allWallets.map(w => {
                const isSol = w.chain === 'solana';
                return (
                  <option key={w.id} value={w.id}>
                    {isSol ? '🟣 [Solana]' : '💎 [TON]'} {w.label} ({w.balance} {isSol ? 'SOL' : 'TON'}) - {w.address.substring(0, 8)}...
                  </option>
                );
              })}
            </select>
          </div>

          {/* Token Asset Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Select Asset Token:</label>
            <div className="flex flex-wrap gap-1.5">
              {isSolana ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedToken('SOL')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selectedToken === 'SOL' 
                        ? 'bg-purple-500/20 border-purple-500 text-white shadow-md' 
                        : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>🟣</span> SOL
                  </button>
                  {SUPPORTED_SOLANA_TOKENS.slice(1).map(t => (
                    <button
                      key={t.symbol}
                      type="button"
                      onClick={() => setSelectedToken(t.symbol)}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        selectedToken === t.symbol 
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-md' 
                          : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>{t.icon}</span> {t.symbol}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedToken('TON')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selectedToken === 'TON' 
                        ? 'bg-[#0098EA]/20 border-[#0098EA] text-white shadow-md' 
                        : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>💎</span> TON
                  </button>

                  {SUPPORTED_JETTONS.map(j => (
                    <button
                      key={j.symbol}
                      type="button"
                      onClick={() => setSelectedToken(j.symbol)}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        selectedToken === j.symbol 
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-md' 
                          : 'bg-[#121b30] border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>{j.icon}</span> {j.symbol}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Destination Address Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Destination Address ({isSolana ? 'Solana Base58' : 'TON'}):
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={isSolana ? "e.g. 7EcBM... (Solana Address / Squads Vault)" : "e.g. UQ... or EQ..."}
              className={`input-field text-xs font-mono ${
                recipient && !isAddressValid ? 'border-red-500 focus:border-red-500' : ''
              }`}
            />
            {recipient && !isAddressValid && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Invalid {isSolana ? 'Solana' : 'TON'} address format
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-300">Amount ({selectedToken}):</label>
              <span className="text-xs text-gray-400">
                Available: <span className="text-emerald-400 font-bold">{currentWallet?.balance || '0.00'} {isSolana ? 'SOL' : 'TON'}</span>
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input-field py-2.5 pr-16 text-sm font-bold"
              />
              <button
                type="button"
                onClick={handleMaxAmount}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-bold bg-[#0098EA]/20 text-[#0098EA] hover:bg-[#0098EA]/30 rounded-md transition-all"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Comment / Memo Input (TON only) */}
          {!isSolana && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Comment / Memo (Optional):</label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Transfer payload"
                className="input-field py-2 text-xs"
              />
            </div>
          )}

          {/* Enforced Minimum Gas Fee Notification */}
          <div className="bg-[#121b30] p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="text-gray-300 font-semibold">Min Fee Auto-Optimized:</span>
            </div>
            <span className="text-emerald-400 font-mono font-bold">{minNetworkFee}</span>
          </div>

          {/* Result Messages */}
          {txResult && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
              txResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {txResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
              <div className="flex-1 overflow-hidden">
                <p className="font-bold">{txResult.success ? 'Transaction Sent Successfully!' : 'Transaction Failed'}</p>
                <p className="text-[11px] opacity-80 truncate">{txResult.error || `TX Ref: ${txResult.txHash}`}</p>
                {txResult.success && isSolana && txResult.txHash && (
                  <a
                    href={`https://solscan.io/tx/${txResult.txHash}${network === 'testnet' ? '?cluster=devnet' : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-purple-400 hover:text-purple-300 underline flex items-center gap-1 mt-1 font-mono"
                  >
                    View on Solscan <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleSendDirect}
              disabled={isSending || !isAddressValid || !isAmountValid}
              className={`w-full btn py-3 text-sm shadow-lg ${
                isSolana 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25'
                  : 'btn-primary shadow-[#0098EA]/30'
              }`}
            >
              {isSending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Signing & Broadcasting...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  Send {selectedToken} ({minNetworkFee})
                </span>
              )}
            </button>

            {isSolana ? (
              <a
                href={solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full btn btn-secondary py-2.5 text-xs flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4 text-purple-400" />
                View Account on Solscan Explorer
              </a>
            ) : (
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full btn btn-secondary py-2.5 text-xs flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4 text-[#0098EA]" />
                Sign in Tonkeeper Mobile App
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
