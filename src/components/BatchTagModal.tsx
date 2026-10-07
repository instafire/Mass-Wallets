import React, { useState, useEffect } from 'react';
import { X, Tag, Check } from 'lucide-react';
import type { ManagedWallet } from '../types';

interface BatchTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWallets: ManagedWallet[];
  onApplyBatchTag: (tag: string, renamePattern?: string) => void;
}

export const BatchTagModal: React.FC<BatchTagModalProps> = ({
  isOpen,
  onClose,
  selectedWallets,
  onApplyBatchTag,
}) => {
  const [newTag, setNewTag] = useState('');
  const [prefixPattern, setPrefixPattern] = useState('');
  const [shouldRename, setShouldRename] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewTag('');
      setPrefixPattern('');
      setShouldRename(false);
    }
  }, [isOpen]);

  if (!isOpen || selectedWallets.length === 0) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    onApplyBatchTag(newTag.trim(), shouldRename ? prefixPattern.trim() : undefined);
    setNewTag('');
    setPrefixPattern('');
    setShouldRename(false);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card max-w-md w-full p-6 border border-white/20 shadow-2xl relative space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Batch Tag & Organize</h3>
              <p className="text-xs text-gray-400">Apply to {selectedWallets.length} selected wallets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              New Category / Batch Tag:
            </label>
            <input
              type="text"
              required
              autoFocus
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="e.g. Staking-Nodes, Tier-1, AirDrop-Pool"
              className="input-field py-2 text-xs"
            />
          </div>

          <div className="pt-2 border-t border-white/5 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 select-none">
              <input
                type="checkbox"
                checked={shouldRename}
                onChange={(e) => setShouldRename(e.target.checked)}
                className="rounded accent-[#0098EA] w-4 h-4"
              />
              <span>Also batch rename labels sequentially</span>
            </label>

            {shouldRename && (
              <div className="pl-6 animate-fadeIn">
                <input
                  type="text"
                  value={prefixPattern}
                  onChange={(e) => setPrefixPattern(e.target.value)}
                  placeholder="e.g. Node # (will create Node #1, Node #2...)"
                  className="input-field py-1.5 text-xs font-mono"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn btn-secondary py-2.5 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTag.trim()}
              className="flex-1 btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply to {selectedWallets.length} Wallets</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
