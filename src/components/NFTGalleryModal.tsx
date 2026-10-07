import React, { useState, useMemo } from 'react';
import type { ManagedWallet, NFTItem, Network } from '../types';
import { 
  X, 
  Image as ImageIcon, 
  Send, 
  ExternalLink, 
  Search, 
  Plus, 
  CheckCircle2, 
  Copy, 
  Check, 
  Tag,
  Wallet
} from 'lucide-react';

interface NFTGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network: Network;
  initialWalletId?: string;
  onOpenSendNFT: (nft: NFTItem, ownerWallet: ManagedWallet) => void;
  onOpenAddNFT: (targetWalletId?: string) => void;
}

export const NFTGalleryModal: React.FC<NFTGalleryModalProps> = ({
  isOpen,
  onClose,
  wallets,
  network,
  initialWalletId,
  onOpenSendNFT,
  onOpenAddNFT,
}) => {
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletId || 'all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeNFTDetail, setActiveNFTDetail] = useState<{ nft: NFTItem; ownerWallet: ManagedWallet } | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  // Synchronize when initialWalletId changes
  React.useEffect(() => {
    if (initialWalletId) {
      setSelectedWalletId(initialWalletId);
    }
  }, [initialWalletId]);

  // Aggregate all NFTs across studio wallets
  const allNFTEntries = useMemo(() => {
    const entries: Array<{ nft: NFTItem; ownerWallet: ManagedWallet }> = [];
    wallets.forEach(w => {
      if (w.nfts && Array.isArray(w.nfts)) {
        w.nfts.forEach(nft => {
          entries.push({ nft, ownerWallet: w });
        });
      }
    });
    return entries;
  }, [wallets]);

  // Available unique collections
  const collections = useMemo(() => {
    const set = new Set<string>();
    allNFTEntries.forEach(entry => {
      if (entry.nft.collectionName) {
        set.add(entry.nft.collectionName);
      }
    });
    return Array.from(set);
  }, [allNFTEntries]);

  // Filtered NFT List
  const filteredNFTs = useMemo(() => {
    return allNFTEntries.filter(entry => {
      const { nft, ownerWallet } = entry;
      // Filter by wallet
      if (selectedWalletId !== 'all' && ownerWallet.id !== selectedWalletId) {
        return false;
      }
      // Filter by collection
      if (selectedCollection !== 'all' && nft.collectionName !== selectedCollection) {
        return false;
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = nft.name.toLowerCase().includes(q);
        const matchesCollection = (nft.collectionName || '').toLowerCase().includes(q);
        const matchesAddress = nft.address.toLowerCase().includes(q);
        const matchesWallet = ownerWallet.label.toLowerCase().includes(q);
        if (!matchesName && !matchesCollection && !matchesAddress && !matchesWallet) {
          return false;
        }
      }
      return true;
    });
  }, [allNFTEntries, selectedWalletId, selectedCollection, searchQuery]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(id);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const getTonviewerLink = (addr: string) => {
    const domain = network === 'mainnet' ? 'tonviewer.com' : 'testnet.tonviewer.com';
    return `https://${domain}/${addr}`;
  };

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-5xl p-6 relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">TON NFT & Collectibles Gallery</h2>
                <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold">
                  {allNFTEntries.length} {allNFTEntries.length === 1 ? 'NFT' : 'NFTs'} Total
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Explore, view high-res artwork, inspect metadata traits, and transfer TON NFTs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddNFT(selectedWalletId !== 'all' ? selectedWalletId : undefined)}
              className="btn btn-primary btn-sm text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add / Mint NFT</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 border-b border-white/5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search NFT name, trait, address..."
              className="input-field pl-9 py-2 text-xs w-full"
            />
          </div>

          {/* Filter by Wallet */}
          <div className="relative">
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="input-field py-2 text-xs w-full cursor-pointer"
            >
              <option value="all">All Studio Wallets ({wallets.length})</option>
              {wallets.map(w => {
                const count = w.nfts?.length || 0;
                return (
                  <option key={w.id} value={w.id}>
                    {w.label} {w.isMainWallet ? '👑' : ''} ({count} {count === 1 ? 'NFT' : 'NFTs'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter by Collection */}
          <div className="relative">
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="input-field py-2 text-xs w-full cursor-pointer"
            >
              <option value="all">All Collections ({collections.length})</option>
              {collections.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* NFT Gallery Grid Area */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[350px]">
          {filteredNFTs.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <ImageIcon className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-white font-bold text-sm">No NFTs Found</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {allNFTEntries.length === 0
                    ? "You don't have any NFTs in your studio wallets yet. Import an on-chain item or mint a custom collectible to get started!"
                    : "No collectibles match the selected wallet or collection filters."}
                </p>
              </div>
              <button
                onClick={() => onOpenAddNFT(selectedWalletId !== 'all' ? selectedWalletId : undefined)}
                className="btn btn-secondary btn-sm text-xs font-bold mt-2 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>Import or Mint Collectible</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredNFTs.map(({ nft, ownerWallet }) => (
                <div
                  key={nft.id}
                  onClick={() => setActiveNFTDetail({ nft, ownerWallet })}
                  className="glass-card p-3 rounded-2xl border border-white/10 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  {/* NFT Image Container */}
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-[#070b14] relative border border-white/5 mb-3 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-300">
                    <img
                      src={nft.image}
                      alt={nft.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60';
                      }}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Verified & Index Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {nft.verified && (
                        <span className="bg-blue-600/90 text-white p-1 rounded-lg backdrop-blur-md shadow-md" title="Verified Collection">
                          <CheckCircle2 className="w-3 h-3" />
                        </span>
                      )}
                      {typeof nft.index === 'number' && (
                        <span className="bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-gray-200 px-1.5 py-0.5 rounded-md border border-white/10">
                          #{nft.index}
                        </span>
                      )}
                    </div>

                    {/* Quick Send Overlay Button */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSendNFT(nft, ownerWallet);
                        }}
                        className="btn btn-primary btn-sm py-1.5 px-3 text-xs font-bold flex items-center gap-1 shadow-lg"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send NFT</span>
                      </button>
                    </div>
                  </div>

                  {/* NFT Info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-purple-400 truncate max-w-[130px]">
                        {nft.collectionName || 'Collectible'}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {ownerWallet.label}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm truncate group-hover:text-purple-300 transition-colors">
                      {nft.name}
                    </h4>

                    {nft.attributes && nft.attributes.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {nft.attributes.slice(0, 2).map((attr, idx) => (
                          <span key={idx} className="bg-white/5 text-gray-300 text-[9px] px-1.5 py-0.5 rounded border border-white/5 truncate max-w-[100px]">
                            {attr.trait_type}: <strong className="text-white">{attr.value}</strong>
                          </span>
                        ))}
                        {nft.attributes.length > 2 && (
                          <span className="text-[9px] text-gray-500 self-center">
                            +{nft.attributes.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-gray-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>Showing <strong className="text-white font-mono">{filteredNFTs.length}</strong> of <strong className="text-white font-mono">{allNFTEntries.length}</strong> NFTs</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-500">TON TEP-62 / TEP-66 Standard</span>
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm text-xs font-semibold py-1 px-3"
            >
              Close
            </button>
          </div>
        </div>

        {/* Detailed NFT Inspector Modal */}
        {activeNFTDetail && (
          <div 
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn"
            onClick={(e) => { if (e.target === e.currentTarget) setActiveNFTDetail(null); }}
          >
            <div className="glass-card max-w-2xl w-full p-6 border border-white/20 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-5">
              
              {/* Header with Close */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold">
                    {activeNFTDetail.nft.collectionName || 'TON NFT'}
                  </span>
                  {activeNFTDetail.nft.verified && (
                    <span className="badge badge-primary text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveNFTDetail(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Content: Split Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Left: High-Res NFT Image */}
                <div className="space-y-3">
                  <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#070b14] border border-white/10 shadow-2xl flex items-center justify-center">
                    <img
                      src={activeNFTDetail.nft.image}
                      alt={activeNFTDetail.nft.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60';
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <a
                    href={activeNFTDetail.nft.image}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#0098EA] hover:underline flex items-center justify-center gap-1 font-semibold"
                  >
                    <span>Open Full-Resolution Asset</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Right: Metadata & Attributes */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-white">{activeNFTDetail.nft.name}</h3>
                    {activeNFTDetail.nft.description && (
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                        {activeNFTDetail.nft.description}
                      </p>
                    )}
                  </div>

                  {/* Owner Wallet Info Box */}
                  <div className="bg-[#080d1a] p-3 rounded-xl border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-purple-400" />
                        Held in Studio Wallet:
                      </span>
                      <strong className="text-white font-semibold">{activeNFTDetail.ownerWallet.label}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 bg-white/5 px-2 py-1 rounded">
                      <span className="truncate max-w-[180px]">{activeNFTDetail.ownerWallet.address}</span>
                      <button
                        onClick={() => handleCopy(activeNFTDetail.ownerWallet.address, 'owner')}
                        className="text-gray-400 hover:text-white p-0.5"
                        title="Copy Owner Address"
                      >
                        {copiedAddr === 'owner' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* NFT Item Contract Address */}
                  <div className="bg-[#080d1a] p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[11px] text-gray-400 font-semibold block">NFT Item Contract Address:</span>
                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-300 bg-white/5 px-2 py-1 rounded">
                      <span className="truncate max-w-[180px]">{activeNFTDetail.nft.address}</span>
                      <button
                        onClick={() => handleCopy(activeNFTDetail.nft.address, 'nft')}
                        className="text-gray-400 hover:text-white p-0.5"
                        title="Copy Contract Address"
                      >
                        {copiedAddr === 'nft' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-end pt-1">
                      <a
                        href={getTonviewerLink(activeNFTDetail.nft.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#0098EA] hover:underline flex items-center gap-1"
                      >
                        <span>View on Tonviewer</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>

                  {/* Attributes & Properties Pill Grid */}
                  {activeNFTDetail.nft.attributes && activeNFTDetail.nft.attributes.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-purple-400" />
                        Traits & Metadata Attributes:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {activeNFTDetail.nft.attributes.map((attr, idx) => (
                          <div key={idx} className="bg-[#0a1020] p-2 rounded-lg border border-white/10 text-center">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">{attr.trait_type}</span>
                            <strong className="text-xs text-purple-300 font-bold block mt-0.5 truncate">{attr.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => {
                        const target = activeNFTDetail;
                        setActiveNFTDetail(null);
                        onOpenSendNFT(target.nft, target.ownerWallet);
                      }}
                      className="btn btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send / Transfer NFT</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};