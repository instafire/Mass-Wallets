import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘ K / Ctrl+K', desc: 'Open Command Palette & Quick Search' },
    { key: '1', desc: 'Switch to Matrix Table View' },
    { key: '2', desc: 'Switch to Batch Explorer View' },
    { key: '3', desc: 'Switch to Cards Grid View' },
    { key: 'Shift + A', desc: 'Select All Filtered Wallets' },
    { key: 'Shift + D', desc: 'Deselect All Wallets' },
    { key: '?', desc: 'Open Keyboard Shortcuts Help' },
    { key: 'ESC', desc: 'Close any active modal or popover' },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card max-w-md w-full p-6 border border-white/20 shadow-2xl relative space-y-4">
        
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Keyboard Shortcuts</h3>
              <p className="text-xs text-gray-400">Power user navigation keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 py-2 text-xs">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 bg-[#080d1a] rounded-xl border border-white/5">
              <span className="text-gray-300">{s.desc}</span>
              <kbd className="font-mono bg-[#121b30] text-[#0098EA] px-2.5 py-1 rounded-lg border border-white/10 font-bold text-[11px] shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
