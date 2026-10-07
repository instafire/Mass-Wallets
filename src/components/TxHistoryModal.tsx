import React, { useState, useEffect } from 'react';
import type { ManagedWallet, Network, Transaction } from '../types';
import { TonService } from '../services/tonService';
import { SolanaService } from '../services/solanaService';
import { X, History, ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

interface TxHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: ManagedWallet | null;
  network: Network;
}

interface SolanaTxItem {
  signature: string;
  slot: number;
  blockTime: number | null;
  status: 'success' | 'failed';
  err: any;
  memo?: string | null;
}

export const TxHistoryModal: React.FC<TxHistoryModalProps> = ({
  isOpen,
  onClose,
  wallet,
  network,
}) => {
  const [tonTransactions, setTonTransactions] = useState<Transaction[]>([]);
  const [solTransactions, setSolTransactions] = useState<SolanaTxItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  const isSolana = wallet?.chain === 'solana' || wallet?.version === 'solana-ed25519' || wallet?.version === 'squads-v4';

  const loadTxHistory = async () => {
    if (!wallet) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (isSolana) {
        const txs = await SolanaService.getTransactionHistory(wallet.address, network, 30);
        setSolTransactions(txs);
      } else {
        const txs = await TonService.fetchTransactions(wallet.address, network);
        setTonTransactions(txs);
      }
    } catch (e: any) {
      console.error('Failed to load transactions:', e);
      setErrorMsg(e?.message || 'Could not fetch transaction history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    if (wallet && isOpen) {
      setIsLoading(true);
      setErrorMsg(null);
      if (isSolana) {
        SolanaService.getTransactionHistory(wallet.address, network, 30)
          .then(txs => {
            if (!isCancelled) setSolTransactions(txs);
          })
          .catch(err => {
            if (!isCancelled) setErrorMsg(err?.message || 'Could not load Solana transactions.');
          })
          .finally(() => {
            if (!isCancelled) setIsLoading(false);
          });
      } else {
        TonService.fetchTransactions(wallet.address, network)
          .then(txs => {
            if (!isCancelled) setTonTransactions(txs);
          })
          .catch(err => {
            if (!isCancelled) setErrorMsg(err?.message || 'Could not load TON transactions.');
          })
          .finally(() => {
            if (!isCancelled) setIsLoading(false);
          });
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [wallet, isOpen, network, isSolana]);

  if (!isOpen || !wallet) return null;

  const getExplorerLinkTon = (txHash: string) => {
    const domain = network === 'mainnet' ? 'tonviewer.com' : 'testnet.tonviewer.com';
    return `https://${domain}/transaction/${txHash}`;
  };

  const getExplorerLinkSol = (sig: string) => {
    return `https://solscan.io/tx/${sig}${network === 'testnet' ? '?cluster=devnet' : ''}`;
  };

  const handleCopySignature = (sig: string) => {
    navigator.clipboard.writeText(sig);
    setCopiedSig(sig);
    setTimeout(() => setCopiedSig(null), 2000);
  };

  const txCount = isSolana ? solTransactions.length : tonTransactions.length;

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSolana ? 'bg-[#9945FF]/20 text-[#14F195]' : 'bg-purple-500/20 text-purple-400'
            }`}>
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Transaction History</h2>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  isSolana ? 'bg-[#9945FF]/20 text-[#14F195] border-[#14F195]/30' : 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/30'
                }`}>
                  {isSolana ? 'SOLANA' : 'TON'}
                </span>
              </div>
              <p className="text-xs text-gray-400">{wallet.label} ({wallet.address.substring(0, 8)}...)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTxHistory}
              disabled={isLoading}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              title="Refresh Transactions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0098EA]' : ''}`} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="py-5">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0098EA]" />
              Fetching live transactions from {isSolana ? 'Solana' : 'TON'} Network...
            </div>
          ) : errorMsg ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-xs text-red-400">{errorMsg}</p>
              <button
                onClick={loadTxHistory}
                className="btn btn-secondary btn-sm text-xs font-semibold"
              >
                Try Again
              </button>
            </div>
          ) : txCount === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              No transactions recorded for this wallet on {network.toUpperCase()}.
            </div>
          ) : isSolana ? (
            /* Solana Transaction List */
            <div className="max-h-80 overflow-y-auto divide-y divide-white/5 bg-[#080d1a] border border-white/10 rounded-xl">
              {solTransactions.map((tx, idx) => (
                <div key={tx.signature || idx} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      tx.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {tx.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white font-bold">
                          {tx.signature.substring(0, 10)}...{tx.signature.substring(tx.signature.length - 8)}
                        </span>
                        <button
                          onClick={() => handleCopySignature(tx.signature)}
                          className="text-gray-400 hover:text-white"
                          title="Copy Signature"
                        >
                          {copiedSig === tx.signature ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          tx.status === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {tx.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                        <span>{tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : `Slot: ${tx.slot}`}</span>
                        {tx.memo && <span className="text-gray-300 bg-white/10 px-1.5 py-0.2 rounded truncate max-w-[150px]">"{tx.memo}"</span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <a
                      href={getExplorerLinkSol(tx.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#14F195] hover:underline flex items-center gap-1 font-semibold"
                    >
                      Solscan
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* TON Transaction List */
            <div className="max-h-80 overflow-y-auto divide-y divide-white/5 bg-[#080d1a] border border-white/10 rounded-xl">
              {tonTransactions.map((tx, idx) => (
                <div key={tx.hash || `${tx.timestamp}-${idx}`} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      tx.type === 'in' 
                        ? 'bg-emerald-500/15 text-emerald-400' 
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {tx.type === 'in' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {tx.type === 'in' ? 'Received TON' : 'Sent TON'}
                        </span>
                        {tx.comment && (
                          <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                            "{tx.comment}"
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {new Date(tx.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`font-extrabold text-sm ${tx.type === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'in' ? '+' : '-'}{tx.amount} TON
                    </p>
                    <a
                      href={getExplorerLinkTon(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#0098EA] hover:underline flex items-center justify-end gap-1 font-semibold"
                    >
                      View on Tonviewer
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

