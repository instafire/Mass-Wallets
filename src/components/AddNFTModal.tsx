import React, { useState } from 'react';
import type { ManagedWallet, NFTItem, Network } from '../types';
import { TonService } from '../services/tonService';
import { ActivityService } from '../services/activityService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Plus, 
  Upload, 
  Image as ImageIcon, 
  Search,
  AlertCircle
} from 'lucide-react';

interface AddNFTModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network: Network;
  initialTargetWalletId?: string;
  onNFTAdded: (updatedWallets: ManagedWallet[]) => void;
}

export const AddNFTModal: React.FC<AddNFTModalProps> = ({
  isOpen,
  onClose,
  wallets,
  network,
  initialTargetWalletId,
  onNFTAdded,
}) => {
  const [tab, setTab] = useState<'import' | 'custom'>('import');
  const [targetWalletId, setTargetWalletId] = useState<string>(initialTargetWalletId || (wallets[0]?.id || ''));

  // Import on-chain address state
  const [importAddress, setImportAddress] = useState<string>('');
  const [isFetchingOnChain, setIsFetchingOnChain] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Custom NFT creation state
  const [customName, setCustomName] = useState<string>('');
  const [customCollection, setCustomCollection] = useState<string>('Custom Studio Collectibles');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [customTraitKey, setCustomTraitKey] = useState<string>('');
  const [customTraitValue, setCustomTraitValue] = useState<string>('');
  const [traitsList, setTraitsList] = useState<Array<{ trait_type: string; value: string }>>([
    { trait_type: 'Type', value: 'Studio Collectible' }
  ]);

  React.useEffect(() => {
    if (initialTargetWalletId) {
      setTargetWalletId(initialTargetWalletId);
    } else if (wallets.length > 0) {
      setTargetWalletId(wallets[0].id);
    }
  }, [initialTargetWalletId, wallets]);

  if (!isOpen) return null;

  const targetWallet = wallets.find(w => w.id === targetWalletId) || wallets[0];

  const handleImportOnChain = async () => {
    if (!targetWallet || !importAddress.trim()) return;
    setIsFetchingOnChain(true);
    setImportError(null);

    try {
      if (!TonService.isValidAddress(importAddress.trim())) {
        throw new Error('Invalid TON contract address format.');
      }

      const baseUrl = network === 'mainnet' ? 'https://toncenter.com/api/v3' : 'https://testnet.toncenter.com/api/v3';
      const res = await fetch(`${baseUrl}/nft/items?address=${encodeURIComponent(importAddress.trim())}`);
      const json = await res.json();

      let nftItem: NFTItem;

      if (json?.nft_items && json.nft_items.length > 0) {
        const item = json.nft_items[0];
        const content = item.content || {};
        const meta = item.metadata || content.metadata || {};
        const rawImg = meta.image || meta.image_url || content.uri || '';
        const image = TonService.resolveNFTImageUrl(rawImg);

        nftItem = {
          id: `custom_${item.address}`,
          address: item.address,
          name: meta.name || item.name || 'TON NFT',
          description: meta.description || '',
          image,
          previewImage: image,
          collectionName: item.collection?.name || 'TON Collection',
          collectionAddress: item.collection_address,
          ownerAddress: targetWallet.address,
          index: item.index,
          verified: !!item.collection?.verified,
          addedAt: Date.now(),
        };
      } else {
        // Fallback generic NFT wrapper for valid contract address
        nftItem = {
          id: `custom_${Date.now()}`,
          address: importAddress.trim(),
          name: `TON NFT (${importAddress.trim().substring(0, 6)}...)`,
          description: 'Imported TON on-chain contract collectible.',
          image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60',
          previewImage: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60',
          collectionName: 'Imported Collectibles',
          ownerAddress: targetWallet.address,
          verified: false,
          addedAt: Date.now(),
        };
      }

      const updated = wallets.map(w => {
        if (w.id === targetWallet.id) {
          return {
            ...w,
            nfts: [...(w.nfts || []), nftItem],
          };
        }
        return w;
      });

      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      onNFTAdded(updated);
      onClose();
    } catch (err: any) {
      setImportError(err?.message || 'Could not import NFT item.');
    } finally {
      setIsFetchingOnChain(false);
    }
  };

  const handleAddTrait = () => {
    if (!customTraitKey.trim() || !customTraitValue.trim()) return;
    setTraitsList([...traitsList, { trait_type: customTraitKey.trim(), value: customTraitValue.trim() }]);
    setCustomTraitKey('');
    setCustomTraitValue('');
  };

  const handleRemoveTrait = (idx: number) => {
    setTraitsList(traitsList.filter((_, i) => i !== idx));
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomImageUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCustom = () => {
    if (!targetWallet || !customName.trim()) return;

    const newNft: NFTItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      address: targetWallet.address, // minted internally or local
      name: customName.trim(),
      description: customDescription.trim() || 'Custom TON Mass Wallet collectible.',
      image: customImageUrl || 'https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?w=500&auto=format&fit=crop&q=60',
      previewImage: customImageUrl || 'https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?w=500&auto=format&fit=crop&q=60',
      collectionName: customCollection.trim() || 'Studio Collectibles',
      ownerAddress: targetWallet.address,
      attributes: traitsList,
      verified: true,
      addedAt: Date.now(),
    };

    const updated = wallets.map(w => {
      if (w.id === targetWallet.id) {
        return {
          ...w,
          nfts: [...(w.nfts || []), newNft],
        };
      }
      return w;
    });

    ActivityService.log({
      type: 'receive',
      title: `Created NFT: ${newNft.name}`,
      description: `Added custom collectible ${newNft.name} to ${targetWallet.label}`,
      toAddress: targetWallet.address,
      token: 'NFT',
      amount: '1',
      status: 'success',
    });

    confetti({ particleCount: 85, spread: 70, origin: { y: 0.6 } });
    onNFTAdded(updated);
    onClose();
  };

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Add & Mint TON NFT Collectibles</h2>
              <p className="text-xs text-gray-400">Import on-chain NFTs by contract address or create custom collectibles</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Wallet Selector */}
        <div className="py-4 border-b border-white/5 space-y-1.5">
          <label className="block text-xs font-semibold text-gray-300">
            Assign / Store Collectible In Studio Wallet:
          </label>
          <select
            value={targetWalletId}
            onChange={(e) => setTargetWalletId(e.target.value)}
            className="input-field py-2 text-xs w-full cursor-pointer"
          >
            {wallets.map(w => (
              <option key={w.id} value={w.id}>
                {w.label} {w.isMainWallet ? '👑 (Master Treasury)' : ''} — {w.address.substring(0, 10)}... ({w.nfts?.length || 0} NFTs)
              </option>
            ))}
          </select>
        </div>

        {/* Tab Selection */}
        <div className="pt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`tab-btn p-2.5 text-center text-xs font-bold transition-all ${
              tab === 'import' ? 'active-purple' : ''
            }`}
          >
            <Search className="w-3.5 h-3.5 mx-auto mb-1 text-blue-400" />
            <span>On-Chain Item</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('custom')}
            className={`tab-btn p-2.5 text-center text-xs font-bold transition-all ${
              tab === 'custom' ? 'active-purple' : ''
            }`}
          >
            <Upload className="w-3.5 h-3.5 mx-auto mb-1 text-indigo-400" />
            <span>Create Custom</span>
          </button>
        </div>

        {/* Tab 2: Custom NFT Creator */}
        {tab === 'custom' && (
          <div className="py-4 space-y-4">
            
            {/* Image Preview & Upload / URL */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#080d1a] p-4 rounded-xl border border-white/10">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#0d1424] border border-white/10 shrink-0 flex items-center justify-center relative group">
                {customImageUrl ? (
                  <img src={customImageUrl} alt="Custom Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-500" />
                )}
              </div>

              <div className="flex-1 space-y-2 w-full">
                <input
                  type="text"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="Paste Image URL (https://... or ipfs://...)"
                  className="input-field text-xs w-full font-mono"
                />
                <div className="flex items-center gap-2">
                  <label className="btn btn-secondary btn-sm text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>Upload Local File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-gray-400">PNG, JPG, WEBP, GIF, SVG</span>
                </div>
              </div>
            </div>

            {/* Name and Collection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  NFT Item Title / Name:
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. VIP Alpha Pass #042"
                  className="input-field text-xs w-full font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Collection Name:
                </label>
                <input
                  type="text"
                  value={customCollection}
                  onChange={(e) => setCustomCollection(e.target.value)}
                  placeholder="e.g. TON VIP Passes"
                  className="input-field text-xs w-full"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Description / Lore:
              </label>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Collectible description and utility..."
                rows={2}
                className="input-field text-xs w-full resize-none"
              />
            </div>

            {/* Custom Metadata Traits */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300">
                Metadata Traits & Attributes:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTraitKey}
                  onChange={(e) => setCustomTraitKey(e.target.value)}
                  placeholder="Trait Type (e.g. Tier)"
                  className="input-field text-xs flex-1"
                />
                <input
                  type="text"
                  value={customTraitValue}
                  onChange={(e) => setCustomTraitValue(e.target.value)}
                  placeholder="Value (e.g. Legendary)"
                  className="input-field text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddTrait}
                  disabled={!customTraitKey.trim() || !customTraitValue.trim()}
                  className="btn btn-secondary btn-sm text-xs font-bold shrink-0"
                >
                  Add Trait
                </button>
              </div>

              {/* Traits Pills List */}
              {traitsList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {traitsList.map((t, idx) => (
                    <span key={idx} className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] px-2 py-1 rounded-lg flex items-center gap-1.5">
                      <span>{t.trait_type}: <strong>{t.value}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTrait(idx)}
                        className="text-purple-300 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleCreateCustom}
              disabled={!customName.trim()}
              className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              <span>Create Collectible & Add to {targetWallet?.label}</span>
            </button>
          </div>
        )}

        {/* Tab 3: Import On-Chain Address */}
        {tab === 'import' && (
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Paste TON NFT Item Contract Address:
              </label>
              <input
                type="text"
                value={importAddress}
                onChange={(e) => {
                  setImportAddress(e.target.value);
                  setImportError(null);
                }}
                placeholder="EQ... (TON NFT Item Address)"
                className="input-field font-mono text-xs w-full"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                We'll fetch on-chain metadata, collection info, and artwork directly from the TON indexer.
              </p>
            </div>

            {importError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleImportOnChain}
              disabled={!importAddress.trim() || isFetchingOnChain}
              className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
            >
              <Search className={`w-4 h-4 ${isFetchingOnChain ? 'animate-spin' : ''}`} />
              <span>{isFetchingOnChain ? 'Fetching on-chain metadata...' : 'Import NFT Collectible'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};