import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  Send, 
  ArrowDownToLine, 
  Fuel, 
  Award, 
  BookOpen, 
  Activity, 
  Download, 
  Crown,
  Image as ImageIcon,
  Layers,
  Coins,
  Zap
} from 'lucide-react';
import type { ManagedWallet, Network } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network?: Network;
  setNetwork?: (net: Network) => void;
  onOpenCreateVault: () => void;
  onOpenMassGenerator: () => void;
  onOpenMassSend: () => void;
  onOpenDistribute: () => void;
  onOpenSweep: () => void;
  onOpenGasBalancer: () => void;
  onOpenAddressBook: () => void;
  onOpenActivityLog: () => void;
  onOpenHealthAudit: () => void;
  onOpenTongramFaucet?: () => void;
  onOpenExportVault: () => void;
  onOpenNFTGallery?: () => void;
  onOpenMassNFTDisperse?: () => void;
  onOpenAddNFT?: () => void;
  onOpenSolanaAddressSheet?: () => void;
  onOpenSolanaTokenPortfolio?: () => void;
  onOpenSolanaFaucet?: () => void;
  onOpenSolanaCostEstimator?: () => void;
  onSelectWallet: (wallet: ManagedWallet) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  wallets,
  network: _network,
  setNetwork: _setNetwork,
  onOpenCreateVault,
  onOpenMassGenerator,
  onOpenMassSend,
  onOpenDistribute,
  onOpenSweep,
  onOpenGasBalancer,
  onOpenAddressBook,
  onOpenActivityLog,
  onOpenHealthAudit,
  onOpenTongramFaucet: _onOpenTongramFaucet,
  onOpenExportVault,
  onOpenNFTGallery,
  onOpenMassNFTDisperse,
  onOpenAddNFT,
  onOpenSolanaAddressSheet,
  onOpenSolanaTokenPortfolio,
  onOpenSolanaFaucet: _onOpenSolanaFaucet,
  onOpenSolanaCostEstimator,
  onSelectWallet,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const actions = [
    {
      id: 'act-solana-cost-estimator',
      title: 'Solana Token Distribution Cost Estimator (SOL)',
      category: 'Solana',
      icon: <Zap className="w-4 h-4 text-[#14F195]" />,
      action: () => { onClose(); onOpenSolanaCostEstimator?.(); },
    },
    {
      id: 'act-solana-portfolio',
      title: 'Solana SPL Token Portfolio & Balances',
      category: 'Solana',
      icon: <Coins className="w-4 h-4 text-amber-400" />,
      action: () => { onClose(); onOpenSolanaTokenPortfolio?.(); },
    },
    {
      id: 'act-solana-address-sheet',
      title: 'Solana Address Sheet (Easy Copy & Distribute)',
      category: 'Solana',
      icon: <Layers className="w-4 h-4 text-[#14F195]" />,
      action: () => { onClose(); onOpenSolanaAddressSheet?.(); },
    },
    {
      id: 'act-generator',
      title: 'Mass Create Wallets',
      category: 'Actions',
      icon: <Sparkles className="w-4 h-4 text-[#0098EA]" />,
      action: () => { onClose(); onOpenMassGenerator(); },
    },
    {
      id: 'act-distribute',
      title: 'Distribute Funds from Treasury',
      category: 'Actions',
      icon: <Send className="w-4 h-4 text-amber-400" />,
      action: () => { onClose(); onOpenDistribute(); },
    },
    {
      id: 'act-gas-balancer',
      title: 'Smart Gas Auto-Balancer',
      category: 'Actions',
      icon: <Fuel className="w-4 h-4 text-amber-300" />,
      action: () => { onClose(); onOpenGasBalancer(); },
    },
    {
      id: 'act-sweep',
      title: 'Sweep Sub-Wallets to Treasury',
      category: 'Actions',
      icon: <ArrowDownToLine className="w-4 h-4 text-emerald-400" />,
      action: () => { onClose(); onOpenSweep(); },
    },
    {
      id: 'act-mass-send',
      title: 'Mass Multi-Send Transfer',
      category: 'Actions',
      icon: <Send className="w-4 h-4 text-blue-400" />,
      action: () => { onClose(); onOpenMassSend(); },
    },
    {
      id: 'act-vault',
      title: 'Generate Master Vault Wallet',
      category: 'Actions',
      icon: <Crown className="w-4 h-4 text-yellow-400" />,
      action: () => { onClose(); onOpenCreateVault(); },
    },
    {
      id: 'act-contacts',
      title: 'Address Book & Contacts',
      category: 'Tools',
      icon: <BookOpen className="w-4 h-4 text-purple-400" />,
      action: () => { onClose(); onOpenAddressBook(); },
    },
    {
      id: 'act-activity',
      title: 'Activity Log & Audit Trail',
      category: 'Tools',
      icon: <Activity className="w-4 h-4 text-indigo-400" />,
      action: () => { onClose(); onOpenActivityLog(); },
    },
    {
      id: 'act-health',
      title: 'Security & Health Audit',
      category: 'Tools',
      icon: <Award className="w-4 h-4 text-pink-400" />,
      action: () => { onClose(); onOpenHealthAudit(); },
    },
    {
      id: 'act-export',
      title: 'Export Full Master Backup (JSON)',
      category: 'Backup',
      icon: <Download className="w-4 h-4 text-cyan-400" />,
      action: () => { onClose(); onOpenExportVault(); },
    },
    {
      id: 'act-nft-gallery',
      title: 'NFT & Collectibles Gallery',
      category: 'NFTs',
      icon: <ImageIcon className="w-4 h-4 text-purple-400" />,
      action: () => { onClose(); if (onOpenNFTGallery) onOpenNFTGallery(); },
    },
    {
      id: 'act-nft-disperse',
      title: 'Mass Disperse & Drop NFTs',
      category: 'NFTs',
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      action: () => { onClose(); if (onOpenMassNFTDisperse) onOpenMassNFTDisperse(); },
    },
    {
      id: 'act-nft-add',
      title: 'Add / Mint Collectible NFT',
      category: 'NFTs',
      icon: <Sparkles className="w-4 h-4 text-purple-300" />,
      action: () => { onClose(); if (onOpenAddNFT) onOpenAddNFT(); },
    },
  ];

  // Search through actions and wallets
  const filteredActions = actions.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase().trim())
  );

  const filteredWalletResults = query.trim().length >= 2
    ? wallets.map((w, idx) => ({ ...w, originalIndex: idx + 1 })).filter((w) => {
        const q = query.toLowerCase().trim();
        return (
          w.label.toLowerCase().includes(q) ||
          w.address.toLowerCase().includes(q) ||
          w.tag.toLowerCase().includes(q) ||
          `#${w.originalIndex}`.includes(q)
        );
      }).slice(0, 8)
    : [];

  const combinedItems = [
    ...filteredActions.map(a => ({ type: 'action' as const, data: a })),
    ...filteredWalletResults.map((w) => ({ type: 'wallet' as const, data: w })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, combinedItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + combinedItems.length) % Math.max(1, combinedItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = combinedItems[selectedIndex];
      if (current) {
        if (current.type === 'action') {
          current.data.action();
        } else {
          onSelectWallet(current.data);
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/75 backdrop-blur-md p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        tabIndex={-1}
        className="glass-card max-w-xl w-full border border-white/20 shadow-2xl overflow-hidden relative space-y-0 focus:outline-none"
        onKeyDown={handleKeyDown}
      >
        {/* Search Bar Input */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#080d1a]">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search 1,111+ wallets..."
            className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-500 font-medium"
          />
          <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 select-none">
            ESC to close
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-white/5">
          {combinedItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No matching actions or wallets found.
            </div>
          ) : (
            combinedItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              if (item.type === 'action') {
                return (
                  <button
                    key={item.data.id}
                    onClick={item.data.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all ${
                      isSelected ? 'bg-[#0098EA]/20 text-white border border-[#0098EA]/30' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#121b30] flex items-center justify-center">
                        {item.data.icon}
                      </div>
                      <span className="text-xs font-bold">{item.data.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{item.data.category}</span>
                  </button>
                );
              }

              const w = item.data as ManagedWallet & { originalIndex?: number };
              return (
                <button
                  key={w.id}
                  onClick={() => { onSelectWallet(w); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all ${
                    isSelected ? 'bg-purple-600/20 text-white border border-purple-500/30' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                      #{w.originalIndex || 1}
                    </div>
                    <div>
                      <span className="text-xs font-bold block">{w.label}</span>
                      <span className="text-[11px] font-mono text-gray-400 truncate max-w-xs block">
                        {w.address}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {w.balance} TON
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="p-2.5 bg-[#080d1a] border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500 px-4">
          <div className="flex items-center gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Mass Wallet</span>
        </div>

      </div>
    </div>
  );
};
