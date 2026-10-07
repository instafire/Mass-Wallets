import React, { useState, useMemo } from 'react';
import type { ManagedWallet, NFTItem, Network, MassNFTTransferItem } from '../types';
import { TonService } from '../services/tonService';
import { ActivityService } from '../services/activityService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Send, 
  CheckCircle2, 
  Layers, 
  ArrowRight, 
  Check, 
  RefreshCw
} from 'lucide-react';

interface MassNFTDisperseModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network: Network;
  mainWallet?: ManagedWallet | null;
  onDistributionComplete: () => void;
}

export const MassNFTDisperseModal: React.FC<MassNFTDisperseModalProps> = ({
  isOpen,
  onClose,
  wallets,
  network,
  mainWallet: _mainWallet,
  onDistributionComplete,
}) => {
  const [selectedNFTIds, setSelectedNFTIds] = useState<Set<string>>(new Set());
  const [targetMode, setTargetMode] = useState<'subwallets' | 'custom'>('subwallets');
  const [customRecipientsText, setCustomRecipientsText] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [transferQueue, setTransferQueue] = useState<MassNFTTransferItem[]>([]);
  const [comment, setComment] = useState<string>('Mass NFT Drop');

  // Collect all available NFTs in the studio
  const availableNFTs = useMemo(() => {
    const list: Array<{ nft: NFTItem; ownerWallet: ManagedWallet }> = [];
    wallets.forEach(w => {
      if (w.nfts && Array.isArray(w.nfts)) {
        w.nfts.forEach(nft => {
          list.push({ nft, ownerWallet: w });
        });
      }
    });
    return list;
  }, [wallets]);

  // Sub-wallets available as recipients (excluding main wallet or self)
  const recipientSubWallets = useMemo(() => {
    return wallets.filter(w => !w.isMainWallet);
  }, [wallets]);

  // Initialize selected NFTs when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (availableNFTs.length > 0) {
        setSelectedNFTIds(new Set(availableNFTs.map(item => item.nft.id)));
      } else {
        setSelectedNFTIds(new Set());
      }
      setIsExecuting(false);
      setTransferQueue([]);
    }
  }, [isOpen, availableNFTs]);

  // Build the planned distribution queue (must be called unconditionally for Rules of Hooks)
  const selectedItems = availableNFTs.filter(item => selectedNFTIds.has(item.nft.id));

  const plannedQueue: MassNFTTransferItem[] = useMemo(() => {
    if (selectedItems.length === 0) return [];

    if (targetMode === 'subwallets') {
      return selectedItems.map((item, idx) => {
        const targetWallet = recipientSubWallets[idx % Math.max(1, recipientSubWallets.length)] || item.ownerWallet;
        return {
          id: `queue_${item.nft.id}_${idx}`,
          nft: item.nft,
          fromWallet: item.ownerWallet,
          recipientAddress: targetWallet.address,
          comment,
          status: 'idle',
        };
      });
    } else {
      const addresses = customRecipientsText
        .split('\n')
        .map(a => a.trim())
        .filter(a => a.length > 0 && TonService.isValidAddress(a));

      return selectedItems.map((item, idx) => {
        const targetAddr = addresses[idx % Math.max(1, addresses.length)] || item.ownerWallet.address;
        return {
          id: `queue_${item.nft.id}_${idx}`,
          nft: item.nft,
          fromWallet: item.ownerWallet,
          recipientAddress: targetAddr,
          comment,
          status: 'idle',
        };
      });
    }
  }, [selectedItems, targetMode, recipientSubWallets, customRecipientsText, comment]);

  if (!isOpen) return null;

  const toggleSelectNFT = (id: string) => {
    const next = new Set(selectedNFTIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedNFTIds(next);
  };

  const selectAllNFTs = () => {
    if (selectedNFTIds.size === availableNFTs.length) {
      setSelectedNFTIds(new Set());
    } else {
      setSelectedNFTIds(new Set(availableNFTs.map(item => item.nft.id)));
    }
  };

  const totalGasRequired = plannedQueue.length * 0.05;

  const handleStartDisperse = async () => {
    if (plannedQueue.length === 0 || isExecuting) return;

    setIsExecuting(true);
    const queue = [...plannedQueue];
    setTransferQueue(queue);
    setExecutionProgress({ current: 0, total: queue.length });

    let successCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      queue[i] = { ...queue[i], status: 'pending' };
      setTransferQueue([...queue]);
      setExecutionProgress({ current: i + 1, total: queue.length });

      try {
        const res = await TonService.sendNFT(
          item.fromWallet,
          item.nft.address,
          item.recipientAddress,
          item.comment || comment,
          network,
          '0.05',
          '0.01'
        );

        if (res.success) {
          queue[i] = { ...queue[i], status: 'success', txHash: res.txHash };
          successCount++;

          // Optimistically update owner
          if (item.fromWallet.nfts) {
            item.fromWallet.nfts = item.fromWallet.nfts.filter(n => n.id !== item.nft.id && n.address !== item.nft.address);
          }
          const targetW = wallets.find(w => w.address.toLowerCase() === item.recipientAddress.toLowerCase());
          if (targetW) {
            targetW.nfts = [...(targetW.nfts || []), { ...item.nft, ownerAddress: targetW.address }];
          }
        } else {
          queue[i] = { ...queue[i], status: 'failed', error: res.error };
        }
      } catch (err: any) {
        queue[i] = { ...queue[i], status: 'failed', error: err?.message || 'Transfer failed' };
      }

      setTransferQueue([...queue]);

      if (i < queue.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    ActivityService.log({
      type: 'send',
      title: 'Mass NFT Disperse Completed',
      description: `Dispersed ${successCount} of ${queue.length} NFTs across recipient wallets.`,
      walletCount: successCount,
      token: 'NFT',
      amount: successCount.toString(),
      status: successCount > 0 ? 'success' : 'failed',
    });

    setIsExecuting(false);
    if (successCount > 0) {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
    }
    onDistributionComplete();
  };

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !isExecuting) onClose(); }}
    >
      <div className="modal-content max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Mass NFT Batch Disperse & Drop</h2>
              <p className="text-xs text-gray-400">Distribute multiple TON NFTs across studio sub-wallets or custom addresses</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isExecuting}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 flex-1">
          
          {/* Step 1: Select Source NFTs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-300">
                1. Select NFTs to Disperse ({selectedNFTIds.size} / {availableNFTs.length} selected):
              </label>
              <button
                type="button"
                onClick={selectAllNFTs}
                className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold"
              >
                {selectedNFTIds.size === availableNFTs.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {availableNFTs.length === 0 ? (
              <div className="text-center py-8 bg-[#080d1a] rounded-xl border border-white/10 text-xs text-gray-400">
                No NFTs available in your studio wallets. Add or mint NFTs first.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                {availableNFTs.map(({ nft, ownerWallet }) => {
                  const isSelected = selectedNFTIds.has(nft.id);
                  return (
                    <div
                      key={nft.id}
                      onClick={() => toggleSelectNFT(nft.id)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-500/10' 
                          : 'border-white/10 bg-[#080d1a] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#0a1020] shrink-0 border border-white/5 flex items-center justify-center">
                        <img
                          src={nft.image}
                          alt={nft.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60';
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{nft.name}</h4>
                        <span className="text-[10px] text-gray-400 truncate block">
                          Held: {ownerWallet.label}
                        </span>
                      </div>
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-500'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Distribution Target Configuration */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-300">
              2. Distribution Strategy:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('subwallets')}
                className={`tab-btn p-2.5 text-xs font-bold text-center ${
                  targetMode === 'subwallets' ? 'active-purple' : ''
                }`}
              >
                Distribute to Sub-Wallets ({recipientSubWallets.length})
              </button>

              <button
                type="button"
                onClick={() => setTargetMode('custom')}
                className={`tab-btn p-2.5 text-xs font-bold text-center ${
                  targetMode === 'custom' ? 'active-purple' : ''
                }`}
              >
                Paste Custom Address List
              </button>
            </div>

            {targetMode === 'custom' && (
              <textarea
                value={customRecipientsText}
                onChange={(e) => setCustomRecipientsText(e.target.value)}
                placeholder="Paste TON recipient addresses (one per line)..."
                rows={3}
                className="input-field text-xs font-mono w-full resize-none mt-2"
              />
            )}
          </div>

          {/* Comment & Gas Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#080d1a] p-3.5 rounded-xl border border-white/10 text-xs">
            <div>
              <span className="text-gray-400 font-semibold block mb-1">Transfer Memo / Payload:</span>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Mass NFT Drop"
                className="input-field text-xs w-full py-1 px-2"
              />
            </div>

            <div className="flex flex-col justify-center text-right">
              <span className="text-gray-400">Total Transfers: <strong className="text-white font-mono">{plannedQueue.length} NFTs</strong></span>
              <span className="text-amber-300 font-semibold mt-0.5">Estimated Gas: ~{totalGasRequired.toFixed(2)} TON</span>
            </div>
          </div>

          {/* Step 3: Planned Execution Queue */}
          {plannedQueue.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-300 block">
                3. Distribution Queue Preview:
              </span>
              <div className="max-h-40 overflow-y-auto divide-y divide-white/5 bg-[#080d1a] border border-white/10 rounded-xl">
                {plannedQueue.map((item, idx) => {
                  const currentStatus = transferQueue.find(q => q.id === item.id)?.status || 'idle';
                  return (
                    <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-[10px] text-gray-500 w-5">#{idx + 1}</span>
                        <span className="font-bold text-white truncate max-w-[140px]">{item.nft.name}</span>
                        <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />
                        <span className="font-mono text-gray-400 truncate max-w-[160px] text-[11px]">
                          {item.recipientAddress}
                        </span>
                      </div>

                      <div>
                        {currentStatus === 'idle' && (
                          <span className="badge bg-white/5 text-gray-400 text-[10px]">Queued</span>
                        )}
                        {currentStatus === 'pending' && (
                          <span className="badge bg-amber-500/20 text-amber-300 text-[10px] flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            Broadcasting
                          </span>
                        )}
                        {currentStatus === 'success' && (
                          <span className="badge bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Sent
                          </span>
                        )}
                        {currentStatus === 'failed' && (
                          <span className="badge bg-red-500/20 text-red-300 text-[10px]">Failed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Execution Progress Bar */}
          {isExecuting && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-gray-300">
                <span>Broadcasting NFT Drops...</span>
                <span className="font-mono font-bold text-purple-400">
                  {executionProgress.current} / {executionProgress.total}
                </span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(executionProgress.current / Math.max(1, executionProgress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="btn btn-secondary text-xs font-semibold py-2 px-4"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleStartDisperse}
            disabled={plannedQueue.length === 0 || isExecuting}
            className="btn btn-primary text-xs font-bold py-2.5 px-6 flex items-center gap-2 shadow-lg disabled:opacity-40"
          >
            <Send className={`w-4 h-4 ${isExecuting ? 'animate-spin' : ''}`} />
            <span>{isExecuting ? 'Dispersing NFTs...' : `Disperse ${plannedQueue.length} NFTs Now`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};