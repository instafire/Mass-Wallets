import React, { useState, useEffect } from 'react';
import type { ManagedWallet } from '../types';
import { X, Edit3, Tag, Check } from 'lucide-react';

interface EditWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: ManagedWallet | null;
  onSave: (updatedWallet: ManagedWallet) => void;
}

export const EditWalletModal: React.FC<EditWalletModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onSave,
}) => {
  const [label, setLabel] = useState<string>('');
  const [tag, setTag] = useState<string>('');

  useEffect(() => {
    if (wallet) {
      setLabel(wallet.label);
      setTag(wallet.tag);
    }
  }, [wallet]);

  if (!isOpen || !wallet) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    onSave({
      ...wallet,
      label: label.trim(),
      tag: tag.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Edit Wallet Info</h2>
              <p className="text-xs text-gray-400">Update label and organization tag</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-5 space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Wallet Label:</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Master Treasury #1"
              required
              className="input-field py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Organization Tag / Category:</label>
            <div className="relative">
              <Tag className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. Airdrop, Treasury, Nodes"
                className="input-field pl-9 py-2 text-xs"
              />
            </div>
          </div>

          <div className="bg-[#080d1a] p-3 rounded-xl border border-white/5 text-xs">
            <span className="text-gray-400 block mb-1">Address:</span>
            <span className="font-mono text-gray-300 break-all">{wallet.address}</span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm py-2 px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm py-2 px-4 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
