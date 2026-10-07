import React, { useState, memo } from 'react';
import type { ManagedWallet } from '../types';
import { PriceService } from '../services/priceService';
import { 
  Copy, 
  Check, 
  Send, 
  QrCode, 
  Key, 
  History, 
  Trash2, 
  Edit3, 
  Tag, 
  Crown,
  ShieldCheck
} from 'lucide-react';

interface WalletCardProps {
  wallet: ManagedWallet;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onSend: (wallet: ManagedWallet) => void;
  onReceive: (wallet: ManagedWallet) => void;
  onRevealMnemonic: (wallet: ManagedWallet) => void;
  onViewHistory: (wallet: ManagedWallet) => void;
  onEditWallet?: (wallet: ManagedWallet) => void;
  onViewNFTs?: (wallet: ManagedWallet) => void;
  onDelete: (id: string) => void;
}

const WalletCardComponent: React.FC<WalletCardProps> = ({
  wallet,
  isSelected,
  onToggleSelect,
  onSend,
  onReceive,
  onRevealMnemonic,
  onViewHistory,
  onEditWallet,
  onViewNFTs,
  onDelete,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedVault, setCopiedVault] = useState<boolean>(false);

  const isSolana = wallet.chain === 'solana' || wallet.version === 'solana-ed25519' || wallet.version === 'squads-v4' || !!wallet.privateKey;
  const shortAddress = `${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 6)}`;
  const balanceNum = parseFloat(wallet.balance || '0');

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyVault = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (wallet.squadsVaultAddress) {
      navigator.clipboard.writeText(wallet.squadsVaultAddress);
      setCopiedVault(true);
      setTimeout(() => setCopiedVault(false), 2000);
    }
  };

  const getVersionBadgeClass = (version: string) => {
    switch (version) {
      case 'v4R2':
        return 'badge-primary';
      case 'W5':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      case 'v3R2':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case 'solana-ed25519':
        return 'bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30';
      case 'squads-v4':
        return 'bg-gradient-to-r from-[#9945FF]/30 to-[#14F195]/20 text-[#14F195] border border-[#14F195]/40';
      default:
        return 'badge-primary';
    }
  };

  // Filter secondary jettons / SPL tokens that have balance > 0
  const activeTokens = wallet.jettons?.filter(j => parseFloat(j.balance || '0') > 0 && j.symbol !== 'TON' && j.symbol !== 'SOL') || [];

  return (
    <div
      className={`glass-card p-5 transition-all duration-200 hover:border-white/20 relative group ${
        isSelected ? 'border-[#0098EA] shadow-lg shadow-[#0098EA]/10 ring-1 ring-[#0098EA]' : ''
      } ${wallet.isMainWallet ? 'border-amber-500/40 shadow-md shadow-amber-500/5' : ''}`}
    >
      {/* Top Row: Checkbox, Label, Chain Badge, Version & Delete */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(wallet.id)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-[#0098EA] focus:ring-[#0098EA] focus:ring-offset-gray-900 cursor-pointer"
          />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                isSolana 
                  ? 'bg-[#9945FF]/20 text-[#14F195] border-[#14F195]/30' 
                  : 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30'
              }`}>
                {isSolana ? 'SOL' : 'TON'}
              </span>

              <h4 className="font-bold text-white text-sm tracking-tight truncate max-w-[140px]">{wallet.label}</h4>

              {wallet.isMainWallet && (
                <span className="badge badge-gold flex items-center gap-0.5 text-[9px] py-0">
                  <Crown className="w-2.5 h-2.5" /> Treasury
                </span>
              )}
              
              <span className={`badge text-[10px] py-0 ${getVersionBadgeClass(wallet.version)}`}>
                {wallet.version === 'solana-ed25519' ? 'Ed25519' : wallet.version === 'squads-v4' ? 'Squads v4' : wallet.version}
              </span>

              {onEditWallet && (
                <button
                  onClick={() => onEditWallet(wallet)}
                  className="text-gray-500 hover:text-gray-300 p-0.5 rounded transition-all"
                  title="Edit label & tag"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
            </div>

            {wallet.tag && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                <Tag className="w-3 h-3 text-[#0098EA]" />
                {wallet.tag}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(wallet.id)}
          className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-60 group-hover:opacity-100"
          title="Delete wallet"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Address & Copy Row */}
      <div className="bg-[#080d1a] p-2 rounded-xl border border-white/5 flex items-center justify-between mb-2.5">
        <span className="font-mono text-xs text-gray-300 tracking-wide truncate pr-2">
          {shortAddress}
        </span>
        <button
          onClick={handleCopyAddress}
          className="px-2 py-0.5 rounded-lg text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all shrink-0 flex items-center gap-1 text-[11px] font-semibold"
          title="Copy Address"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Squads Protocol v4 Vault PDA (if available) */}
      {wallet.squadsVaultAddress && (
        <div className="bg-[#0f172a] px-2 py-1.5 rounded-lg border border-[#9945FF]/30 flex items-center justify-between mb-3 text-[11px]">
          <span className="text-[#14F195] font-mono truncate pr-1">
            Vault: {wallet.squadsVaultAddress.substring(0, 6)}...{wallet.squadsVaultAddress.substring(wallet.squadsVaultAddress.length - 4)}
          </span>
          <button
            onClick={handleCopyVault}
            className="text-xs text-[#14F195] hover:underline flex items-center gap-1 shrink-0 font-semibold"
            title="Copy Squads v4 Vault PDA"
          >
            {copiedVault ? <Check className="w-3 h-3 text-emerald-400" /> : <ShieldCheck className="w-3 h-3" />}
            <span>Vault</span>
          </button>
        </div>
      )}

      {/* Balance Display */}
      <div className="space-y-2 mb-4">
        <div className="bg-[#080d1a] p-3 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <span>{isSolana ? '🟣' : '💎'}</span> {isSolana ? 'SOL Balance' : 'TON Balance'}
            </span>
            <span className="text-[11px] text-emerald-400/80 font-mono font-semibold block mt-0.5">
              ≈ {isSolana ? PriceService.formatSolUsd(balanceNum) : PriceService.formatUsd(balanceNum)}
            </span>
          </div>
          <div className="text-right">
            <span className={`text-xl font-extrabold font-mono ${balanceNum > 0 ? 'text-emerald-400' : 'text-gray-200'}`}>
              {wallet.balance}
            </span>
            <span className="text-xs text-gray-400 ml-1.5 font-bold">{isSolana ? 'SOL' : 'TON'}</span>
            {wallet.balanceStale && (
              <span className="block text-[9px] font-bold text-amber-400/90 mt-0.5" title="Last refresh failed — this is the previous known balance, not a fresh reading">
                STALE
              </span>
            )}
          </div>
        </div>

        {/* Active Secondary Tokens if any */}
        {activeTokens.length > 0 && (
          <div className="space-y-1">
            {activeTokens.map(j => (
              <div key={j.symbol} className="bg-[#121b30] px-2.5 py-1.5 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate pr-2">
                  <span className="text-gray-300 font-semibold">{j.icon || '🪙'} {j.symbol}</span>
                  {j.jettonAddress?.endsWith('pump') && (
                    <span className="text-[9px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      pump.fun
                    </span>
                  )}
                </div>
                <span className="font-mono font-bold text-amber-400 shrink-0">{j.balance} {j.symbol}</span>
              </div>
            ))}
          </div>
        )}

        {/* Owned NFTs Badge if any */}
        {wallet.nfts && wallet.nfts.length > 0 && (
          <button
            type="button"
            onClick={() => onViewNFTs && onViewNFTs(wallet)}
            className="w-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-all cursor-pointer text-left"
            title="View NFTs in Gallery"
          >
            <span className="text-purple-300 font-semibold flex items-center gap-1">
              <span>🖼️</span> {wallet.nfts.length} {wallet.nfts.length === 1 ? 'NFT' : 'NFTs'} Owned
            </span>
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
              View Gallery →
            </span>
          </button>
        )}
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10">
        <button
          onClick={() => onSend(wallet)}
          className="btn btn-secondary btn-sm flex flex-col items-center justify-center py-2 gap-1 text-xs"
          title={`Send ${isSolana ? 'SOL' : 'TON'}`}
        >
          <Send className={`w-3.5 h-3.5 ${isSolana ? 'text-[#14F195]' : 'text-[#0098EA]'}`} />
          <span className="text-[10px]">Send</span>
        </button>

        <button
          onClick={() => onReceive(wallet)}
          className="btn btn-secondary btn-sm flex flex-col items-center justify-center py-2 gap-1 text-xs"
          title="Show Receive QR Code"
        >
          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px]">Receive</span>
        </button>

        <button
          onClick={() => onRevealMnemonic(wallet)}
          className="btn btn-secondary btn-sm flex flex-col items-center justify-center py-2 gap-1 text-xs"
          title="View Private Key & Credentials"
        >
          <Key className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px]">Keys</span>
        </button>

        <button
          onClick={() => onViewHistory(wallet)}
          className="btn btn-secondary btn-sm flex flex-col items-center justify-center py-2 gap-1 text-xs"
          title="View Transaction History"
        >
          <History className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px]">History</span>
        </button>
      </div>
    </div>
  );
};

export const WalletCard = memo(WalletCardComponent);
