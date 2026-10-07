import React, { useState, useEffect, useRef } from 'react';
import type { ManagedWallet, Network, MassSendItem } from '../types';
import { isSolanaWallet } from '../types';
import { TonService, SUPPORTED_JETTONS } from '../services/tonService';
import { SolanaService, SUPPORTED_SOLANA_TOKENS } from '../services/solanaService';
import confetti from 'canvas-confetti';
import { X, Send, RefreshCw, Users, ShieldAlert } from 'lucide-react';

interface MassSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderWallets: ManagedWallet[];
  preSelectedRecipients?: ManagedWallet[];
  network: Network;
  onMassSendCompleted: () => void;
}

export const MassSendModal: React.FC<MassSendModalProps> = ({
  isOpen,
  onClose,
  senderWallets,
  preSelectedRecipients = [],
  network,
  onMassSendCompleted,
}) => {
  const [senderId, setSenderId] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('TON');
  const [equalAmount, setEqualAmount] = useState<string>('0.1');
  const [globalComment, setGlobalComment] = useState<string>('Mass Distribution');
  const [recipients, setRecipients] = useState<MassSendItem[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [rawTextInput, setRawTextInput] = useState<string>('');
  const [inputMode, setInputMode] = useState<'selected' | 'text'>('selected');

  const equalAmountRef = useRef(equalAmount);
  equalAmountRef.current = equalAmount;
  const globalCommentRef = useRef(globalComment);
  globalCommentRef.current = globalComment;

  useEffect(() => {
    if (senderWallets.length > 0 && !senderId) {
      const sorted = [...senderWallets].sort((a, b) => parseFloat(b.balance || '0') - parseFloat(a.balance || '0'));
      setSenderId(sorted[0].id);
    }
  }, [senderWallets, senderId]);

  const activeSender = senderWallets.find(w => w.id === senderId);
  const isSolanaSender = isSolanaWallet(activeSender);

  useEffect(() => {
    if (isSolanaSender && selectedToken === 'TON') {
      setSelectedToken('SOL');
    } else if (!isSolanaSender && selectedToken === 'SOL') {
      setSelectedToken('TON');
    }
  }, [isSolanaSender, selectedToken]);

  useEffect(() => {
    if (preSelectedRecipients.length > 0) {
      const items: MassSendItem[] = preSelectedRecipients.map(w => ({
        recipientAddress: w.address,
        amount: equalAmountRef.current,
        comment: globalCommentRef.current,
        status: 'idle',
      }));
      setRecipients(items);
      setInputMode('selected');
    }
  }, [preSelectedRecipients]);

  if (!isOpen) return null;

  const handleApplyEqualAmount = () => {
    setRecipients(prev => prev.map(r => ({ ...r, amount: equalAmount, comment: globalComment })));
  };

  const handleParseTextInput = () => {
    const lines = rawTextInput.split('\n').filter(l => l.trim().length > 0);
    const items: MassSendItem[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/[\s,;]+/);
      const addr = parts[0];
      const amt = parts[1] || equalAmount;
      const cmt = parts.slice(2).join(' ') || globalComment;

      const isValid = isSolanaSender
        ? SolanaService.isValidAddress(addr)
        : TonService.isValidAddress(addr);

      if (isValid) {
        items.push({
          recipientAddress: addr,
          amount: amt,
          comment: cmt,
          status: 'idle',
        });
      }
    }

    setRecipients(items);
    if (items.length > 0) {
      setInputMode('selected');
    }
  };

  // Realistic per-tx fees: TON ~0.01, jetton ~0.05 (attached + forward gas).
  const minFeePerTx = isSolanaSender ? 0.000005 : (selectedToken === 'TON' ? 0.01 : 0.05);
  const totalAmountNeeded = recipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
  const estimatedGas = recipients.length * minFeePerTx;
  const senderBalance = activeSender ? parseFloat(activeSender.balance || '0') : 0;

  const activeJetton = activeSender?.jettons?.find(j => j.symbol === selectedToken);
  const tokenBal = (isSolanaSender ? selectedToken === 'SOL' : selectedToken === 'TON') 
    ? senderBalance 
    : parseFloat(activeJetton?.balance || '0');
  const hasGas = senderBalance >= estimatedGas;
  const hasToken = tokenBal >= totalAmountNeeded;
  const isBalanceSufficient = (isSolanaSender ? selectedToken === 'SOL' : selectedToken === 'TON')
    ? senderBalance >= (totalAmountNeeded + estimatedGas)
    : (hasGas && hasToken);

  const handleExecuteBatch = async () => {
    if (!activeSender || recipients.length === 0 || !isBalanceSufficient) return;

    setIsExecuting(true);
    const updated = [...recipients];
    let successCount = 0;

    // Running ledger: on-chain balances don't update between sends, so track
    // spend locally and stop the batch before it starts failing on shortfall.
    const isNative = isSolanaSender ? selectedToken === 'SOL' : selectedToken === 'TON';
    let runningNative = senderBalance;
    let runningToken = isNative ? senderBalance : tokenBal;
    const gasPerTx = minFeePerTx;

    for (let i = 0; i < updated.length; i++) {
      const amt = parseFloat(updated[i].amount || '0');
      const nativeNeeded = isNative ? amt + gasPerTx : gasPerTx;
      const tokenNeeded = isNative ? 0 : amt;

      if (runningNative < nativeNeeded || runningToken < tokenNeeded) {
        // Not enough left for this send — mark the rest skipped, don't fire doomed txs.
        for (let j = i; j < updated.length; j++) {
          updated[j] = { ...updated[j], status: 'failed', error: 'Skipped: sender ran out of funds mid-batch' };
        }
        setRecipients([...updated]);
        break;
      }

      updated[i] = { ...updated[i], status: 'pending' };
      setRecipients([...updated]);

      try {
        if (isSolanaSender) {
          let res;
          if (selectedToken === 'SOL') {
            res = await SolanaService.sendSol(
              activeSender,
              updated[i].recipientAddress,
              updated[i].amount,
              network
            );
          } else {
            res = await SolanaService.sendSplToken(
              activeSender,
              updated[i].recipientAddress,
              selectedToken,
              updated[i].amount,
              network
            );
          }

          if (res.success) {
            updated[i] = { ...updated[i], status: 'success', txHash: res.txHash };
            successCount++;
            runningNative -= nativeNeeded;
            runningToken -= tokenNeeded;
          } else {
            updated[i] = { ...updated[i], status: 'failed', error: res.error };
          }
        } else {
          const res = await TonService.sendTransaction(
            activeSender,
            updated[i].recipientAddress,
            updated[i].amount,
            updated[i].comment || globalComment,
            network,
            selectedToken
          );

          if (res.success) {
            updated[i] = { ...updated[i], status: 'success', txHash: res.txHash };
            successCount++;
            runningNative -= nativeNeeded;
            runningToken -= tokenNeeded;
          } else {
            updated[i] = { ...updated[i], status: 'failed', error: res.error };
          }
        }
      } catch (err: any) {
        updated[i] = { ...updated[i], status: 'failed', error: err?.message || 'Send error' };
      }

      setRecipients([...updated]);

      if (i < updated.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }

    setIsExecuting(false);
    if (successCount > 0) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
    onMassSendCompleted();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-3xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSolanaSender ? 'bg-purple-500/20 text-purple-400' : 'bg-[#0098EA]/20 text-[#0098EA]'
            }`}>
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Disperse {selectedToken} (Mass Transfer)</h2>
              <p className="text-xs text-gray-400">
                {isSolanaSender 
                  ? 'Batch send SOL or SPL Tokens (USDC, USDT, BONK, JUP) en masse' 
                  : 'Batch send TON or Jettons (TONGRAM, USDT, NOT) en masse'}
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

        <div className="py-5 space-y-5">
          
          {/* Asset Selection Bar */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Asset Token to Disperse:</label>
            <div className="flex flex-wrap gap-1.5">
              {isSolanaSender ? (
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

          {/* Sender Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Primary Funding Wallet:
              </label>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="input-field py-2 text-xs font-bold"
              >
                {senderWallets.map(w => {
                  const isSol = w.chain === 'solana';
                  return (
                    <option key={w.id} value={w.id}>
                      {isSol ? '🟣 [Solana]' : '💎 [TON]'} {w.label} ({w.balance} {isSol ? 'SOL' : 'TON'}) - {w.address.substring(0, 8)}...
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="bg-[#121b30] p-3 rounded-xl border border-white/10 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-400 block">Required Asset Total:</span>
                <span className="text-emerald-400 font-extrabold text-sm">{totalAmountNeeded.toFixed(2)} {selectedToken}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 block">Sender Balance:</span>
                <span className={`font-bold ${isBalanceSufficient ? 'text-white' : 'text-red-400'}`}>
                  {senderBalance.toFixed(4)} {isSolanaSender ? 'SOL' : 'TON'}
                </span>
              </div>
            </div>
          </div>

          {!isBalanceSufficient && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-xs text-red-300">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                {isSolanaSender
                  ? 'Insufficient SOL balance in funding wallet for transaction fees.'
                  : 'Insufficient TON balance in funding wallet for gas fees.'}
              </span>
            </div>
          )}

          {/* Equal Amount Batch Configuration */}
          <div className="bg-[#080d1a] p-4 rounded-xl border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Amount per Wallet:</label>
              <input
                type="number"
                step="0.01"
                value={equalAmount}
                onChange={(e) => setEqualAmount(e.target.value)}
                className="input-field py-1.5 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Batch Comment / Memo:</label>
              <input
                type="text"
                value={globalComment}
                onChange={(e) => setGlobalComment(e.target.value)}
                className="input-field py-1.5 text-xs"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleApplyEqualAmount}
                className="w-full btn btn-secondary btn-sm py-2"
              >
                Apply to All ({recipients.length})
              </button>
            </div>
          </div>

          {/* Input Mode Selector */}
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-300 border-b border-white/10 pb-2">
            <button
              onClick={() => setInputMode('selected')}
              className={`pb-1 ${inputMode === 'selected' ? 'text-[#0098EA] border-b-2 border-[#0098EA]' : 'text-gray-400'}`}
            >
              Managed Recipients ({recipients.length})
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`pb-1 ${inputMode === 'text' ? 'text-[#0098EA] border-b-2 border-[#0098EA]' : 'text-gray-400'}`}
            >
              Paste Custom Address List
            </button>
          </div>

          {inputMode === 'text' ? (
            <div className="space-y-2">
              <textarea
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                rows={5}
                placeholder={isSolanaSender 
                  ? `7EcBM... 0.5 Solana Airdrop\n9xW2... 1.0 Reward`
                  : `EQ... 50 TONGRAM transfer\nUQ... 100 Reward`}
                className="input-field font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleParseTextInput}
                  className="btn btn-secondary btn-sm"
                >
                  Parse Address List
                </button>
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  Import CSV
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = String(ev.target?.result || '');
                        // Accept "address,amount" or "address amount" per line; strip header row if present
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        const dataLines = lines[0] && /address/i.test(lines[0]) && /amount/i.test(lines[0]) ? lines.slice(1) : lines;
                        setRawTextInput(dataLines.join('\n'));
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <p className="text-[10px] text-gray-500">CSV format: <span className="font-mono">address,amount</span> per line (header row optional)</p>
            </div>
          ) : (
            /* Recipient List Table */
            <div className="max-h-60 overflow-y-auto border border-white/10 rounded-xl bg-[#080d1a] divide-y divide-white/5">
              {recipients.map((r, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-400 w-5">{idx + 1}.</span>
                    <span className="font-mono text-white">
                      {r.recipientAddress.substring(0, 10)}...{r.recipientAddress.substring(r.recipientAddress.length - 8)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold text-emerald-400">{r.amount} {selectedToken}</span>

                    {/* Status Badge */}
                    {r.status === 'idle' && <span className="badge bg-gray-500/20 text-gray-400">Idle</span>}
                    {r.status === 'pending' && (
                      <span className="badge bg-amber-500/20 text-amber-300 animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Sending
                      </span>
                    )}
                    {r.status === 'success' && <span className="badge badge-success">Sent</span>}
                    {r.status === 'failed' && <span className="badge bg-red-500/20 text-red-400">Failed</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Execution Button */}
          <div className="pt-2">
            <button
              onClick={handleExecuteBatch}
              disabled={isExecuting || recipients.length === 0 || !isBalanceSufficient}
              className="w-full btn btn-primary py-3.5 text-base shadow-lg shadow-[#0098EA]/30"
            >
              {isExecuting ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Executing Batch Disperse ({recipients.filter(r => r.status === 'success').length}/{recipients.length})...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />
                  Execute {selectedToken} Mass Transfer ({recipients.length} Recipients)
                </span>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
