import React, { useState, useEffect } from 'react';
import type { ManagedWallet, NFTItem, Network } from '../types';
import { TonService } from '../services/tonService';
import { ActivityService } from '../services/activityService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Send, 
  Fuel, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen,
  ExternalLink
} from 'lucide-react';

interface NFTSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  nft: NFTItem | null;
  senderWallet: ManagedWallet | null;
  allWallets: ManagedWallet[];
  network: Network;
  initialRecipient?: string;
  onOpenAddressBook?: () => void;
  onNFTTransferred: () => void;
}

export const NFTSendModal: React.FC<NFTSendModalProps> = ({
  isOpen,
  onClose,
  nft,
  senderWallet,
  allWallets,
  network,
  initialRecipient = '',
  onOpenAddressBook,
  onNFTTransferred,
}) => {
  const [recipient, setRecipient] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txResult, setTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipient(initialRecipient || '');
      setComment('');
      setTxResult(null);
    }
  }, [isOpen, initialRecipient]);

  if (!isOpen || !nft || !senderWallet) return null;

  const isAddressValid = recipient.trim() !== '' && TonService.isValidAddress(recipient.trim());
  const senderBalance = parseFloat(senderWallet.balance || '0');
  const requiredGas = 0.05;
  const hasEnoughGas = senderBalance >= requiredGas;

  const handleSendDirect = async () => {
    if (!isAddressValid || !hasEnoughGas || isSending) return;

    setIsSending(true);
    setTxResult(null);

    try {
      const res = await TonService.sendNFT(
        senderWallet,
        nft.address,
        recipient.trim(),
        comment.trim(),
        network,
        '0.05',
        '0.01'
      );

      setTxResult(res);

      if (res.success) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        
        // Log to Activity audit
        ActivityService.log({
          type: 'send',
          title: `Transferred NFT: ${nft.name}`,
          description: `Sent ${nft.name} from ${senderWallet.label} to ${recipient.trim().substring(0, 8)}...`,
          fromAddress: senderWallet.address,
          toAddress: recipient.trim(),
          token: 'NFT',
          amount: '1',
          status: 'success',
          txHash: res.txHash,
        });

        // Update local wallet NFT list optimistically
        if (senderWallet.nfts) {
          senderWallet.nfts = senderWallet.nfts.filter(n => n.address !== nft.address && n.id !== nft.id);
        }

        // If recipient is also one of our studio wallets, add it to target
        const targetStudioWallet = allWallets.find(w => w.address.toLowerCase() === recipient.trim().toLowerCase());
        if (targetStudioWallet) {
          const updatedNFT = { ...nft, ownerAddress: targetStudioWallet.address };
          targetStudioWallet.nfts = [...(targetStudioWallet.nfts || []), updatedNFT];
        }

        onNFTTransferred();
      }
    } catch (err: any) {
      setTxResult({ success: false, error: err?.message || 'NFT transfer failed.' });
    } finally {
      setIsSending(false);
    }
  };

  const { webUrl } = TonService.getTonkeeperNFTTransferDeepLink(nft.address, recipient || senderWallet.address, comment);

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Transfer TON NFT</h2>
              <p className="text-xs text-gray-400">Send verified TON collectible to any wallet address</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          
          {/* NFT Card Preview */}
          <div className="bg-[#080d1a] p-3.5 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#0a1020] border border-white/10 shrink-0 flex items-center justify-center">
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
              <span className="text-[11px] text-purple-400 font-medium block truncate">
                {nft.collectionName || 'TON Collection'}
              </span>
              <h4 className="text-sm font-bold text-white truncate">{nft.name}</h4>
              <span className="text-[10px] font-mono text-gray-400 truncate block mt-0.5">
                From: {senderWallet.label} ({senderWallet.address.substring(0, 8)}...)
              </span>
            </div>
          </div>

          {/* Gas Balance Alert */}
          {!hasEnoughGas && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Insufficient TON for Gas:</strong>
                <span>
                  Sender wallet has {senderBalance.toFixed(4)} TON. At least ~0.05 TON is required to cover on-chain NFT transfer gas.
                </span>
              </div>
            </div>
          )}

          {/* Recipient Address */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Destination TON Recipient Address:
              </label>
              {onOpenAddressBook && (
                <button
                  type="button"
                  onClick={onOpenAddressBook}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Contacts</span>
                </button>
              )}
            </div>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="EQ... or UQ... (or friendly address)"
              className={`input-field font-mono text-xs w-full ${
                recipient && !isAddressValid ? 'border-red-500/50 bg-red-500/5' : ''
              }`}
            />
            {recipient && !isAddressValid && (
              <p className="text-[11px] text-red-400 font-semibold mt-1">
                Please enter a valid 48-character TON wallet address.
              </p>
            )}

            {/* Quick Pick: Studio Sub-Wallets */}
            {allWallets.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-gray-500 text-[10px]">Quick select internal wallet:</span>
                {allWallets
                  .filter(w => w.id !== senderWallet.id)
                  .slice(0, 4)
                  .map(w => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setRecipient(w.address)}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-mono border border-white/5 truncate max-w-[120px]"
                    >
                      {w.label}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Optional Transfer Comment / Memo */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Forward Payload Comment / Memo (Optional):
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Gift for John / Studio Transfer"
              maxLength={100}
              className="input-field text-xs w-full"
            />
          </div>

          {/* Gas & Fee Notice */}
          <div className="bg-[#080d1a] p-3 rounded-xl border border-white/10 flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-amber-400" />
              Attached Network Gas Fee:
            </span>
            <span className="font-mono font-bold text-gray-200">
              ~0.05 TON (Excess returned)
            </span>
          </div>

          {/* Result Alert */}
          {txResult && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              txResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {txResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <strong className="block font-bold">
                  {txResult.success ? 'NFT Transfer Broadcast Successfully!' : 'Transfer Failed'}
                </strong>
                <p className="mt-0.5 opacity-90">
                  {txResult.success 
                    ? `Collectible ${nft.name} has been transferred on-chain.`
                    : txResult.error}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleSendDirect}
              disabled={!isAddressValid || !hasEnoughGas || isSending || (txResult?.success ?? false)}
              className="btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? 'Broadcasting...' : 'Transfer NFT Directly'}</span>
            </button>

            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <span>Open in Tonkeeper</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

      </div>
    </div>
  );
};