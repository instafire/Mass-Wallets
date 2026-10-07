import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Send
} from 'lucide-react';
import { AddressBookService, type ContactEntry } from '../services/addressBookService';
import type { Network } from '../types';

interface AddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  network: Network;
  onSendToContact?: (recipientAddress: string) => void;
}

export const AddressBookModal: React.FC<AddressBookModalProps> = ({
  isOpen,
  onClose,
  network,
  onSendToContact,
}) => {
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [tag, setTag] = useState('Exchange');
  const [notes, setNotes] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    return AddressBookService.subscribe(setContacts);
  }, []);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !address.trim()) return;

    AddressBookService.addContact(label, address, tag, notes);
    setLabel('');
    setAddress('');
    setNotes('');
    setIsAdding(false);
  };

  const handleCopy = (id: string, addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="glass-card max-w-2xl w-full p-6 border border-white/20 shadow-2xl relative space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Address Book & Contacts</h2>
              <p className="text-xs text-gray-400">Save frequent deposit addresses, exchanges, and liquidity routers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Contact Form Toggle */}
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="btn btn-secondary btn-sm py-2 px-3 text-xs w-full flex items-center justify-center gap-1.5 text-[#0098EA]"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Contact / Destination Address</span>
          </button>
        ) : (
          <form onSubmit={handleAdd} className="bg-[#080d1a] p-4 rounded-xl border border-white/10 space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">New Contact Entry</span>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Contact Name (e.g. Bybit Deposit)"
                className="input-field py-2 text-xs"
              />
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Tag (e.g. Exchange, CEX, Friend)"
                className="input-field py-2 text-xs"
              />
            </div>

            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="TON Address (EQ... or UQ...)"
              className="input-field py-2 text-xs font-mono"
            />

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="input-field py-2 text-xs"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 btn btn-secondary py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 btn btn-primary py-2 text-xs font-bold"
              >
                Save Contact
              </button>
            </div>
          </form>
        )}

        {/* Contacts List */}
        <div className="max-h-80 overflow-y-auto space-y-2 divide-y divide-white/5">
          {contacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No saved contacts yet. Add your favorite deposit addresses above!
            </div>
          ) : (
            contacts.map(c => {
              const explorerUrl = network === 'mainnet'
                ? `https://tonviewer.com/${c.address}`
                : `https://testnet.tonviewer.com/${c.address}`;

              return (
                <div key={c.id} className="p-3 bg-[#080d1a] rounded-xl border border-white/5 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{c.label}</span>
                      <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                        {c.tag}
                      </span>
                    </div>
                    <p className="font-mono text-gray-400 text-[11px] truncate max-w-sm">
                      {c.address}
                    </p>
                    {c.notes && (
                      <p className="text-[10px] text-gray-500 italic">{c.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onSendToContact && (
                      <button
                        onClick={() => { onSendToContact(c.address); onClose(); }}
                        className="btn btn-primary btn-sm p-1.5"
                        title="Send to this contact"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(c.id, c.address)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-white/5 hover:bg-white/10"
                      title="Copy Address"
                    >
                      {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-purple-400 bg-white/5 hover:bg-white/10"
                      title="Open Tonviewer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => AddressBookService.removeContact(c.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10"
                      title="Delete contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
