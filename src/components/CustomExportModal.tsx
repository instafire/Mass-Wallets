import React, { useState } from 'react';
import type { ManagedWallet } from '../types';
import { X, Copy, Check, Download, Code } from 'lucide-react';

interface CustomExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
}

type ExportFormat = 'colon' | 'private-keys' | 'solana-pairs' | 'squads-vaults' | 'csv' | 'json' | 'python' | 'bash';

export const CustomExportModal: React.FC<CustomExportModalProps> = ({
  isOpen,
  onClose,
  wallets,
}) => {
  const [format, setFormat] = useState<ExportFormat>('colon');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

  const getFormattedOutput = (): string => {
    if (format === 'colon') {
      return wallets.map(w => `${w.address}:${w.mnemonic.join(' ')}`).join('\n');
    }
    if (format === 'private-keys') {
      return wallets.map(w => w.privateKey || w.mnemonic.join(' ')).join('\n');
    }
    if (format === 'solana-pairs') {
      return wallets.map(w => `${w.address}:${w.privateKey || w.mnemonic.join(' ')}`).join('\n');
    }
    if (format === 'squads-vaults') {
      return wallets
        .filter(w => w.squadsVaultAddress)
        .map(w => `${w.address}:${w.squadsVaultAddress}`)
        .join('\n');
    }
    if (format === 'csv') {
      return 'Index,Chain,Address,Private_Key_Base58,Squads_Vault_PDA,Mnemonic,Version,Label\n' + wallets.map((w, idx) => 
        `${idx + 1},${escapeCsv(w.chain || 'ton')},${escapeCsv(w.address)},${escapeCsv(w.privateKey || '')},${escapeCsv(w.squadsVaultAddress || '')},${escapeCsv(w.mnemonic.join(' '))},${escapeCsv(w.version)},${escapeCsv(w.label)}`
      ).join('\n');
    }
    if (format === 'json') {
      return JSON.stringify(wallets.map((w, idx) => ({
        index: idx + 1,
        chain: w.chain || 'ton',
        address: w.address,
        privateKey: w.privateKey || null,
        squadsVaultAddress: w.squadsVaultAddress || null,
        mnemonic: w.mnemonic.join(' '),
        version: w.version,
        label: w.label,
        publicKey: w.publicKey,
      })), null, 2);
    }
    if (format === 'python') {
      const items = wallets.map(w => `    {"address": "${w.address}", "private_key": "${w.privateKey || ''}", "mnemonic": "${w.mnemonic.join(' ')}", "version": "${w.version}"}`).join(',\n');
      return `WALLETS = [\n${items}\n]`;
    }
    if (format === 'bash') {
      const items = wallets.map(w => `"${w.address}:${w.privateKey || w.mnemonic.join(' ')}"`).join('\n  ');
      return `WALLETS=(\n  ${items}\n)`;
    }
    return '';
  };

  const outputText = getFormattedOutput();

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = format === 'json' ? 'json' : format === 'python' ? 'py' : format === 'bash' ? 'sh' : format === 'csv' ? 'csv' : 'txt';
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wallet_export_${format}_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Code className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Custom Exporter & Key Extractor</h2>
              <p className="text-xs text-gray-400">Export private keys, addresses, or Squads v4 vaults for bots and scripts</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          
          {/* Format Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Select Export Format:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormat('private-keys')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'private-keys' ? 'active-amber' : ''}`}
              >
                🔑 Private Keys Only
              </button>
              <button
                type="button"
                onClick={() => setFormat('solana-pairs')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'solana-pairs' ? 'active-purple' : ''}`}
              >
                Address:PrivateKey
              </button>
              <button
                type="button"
                onClick={() => setFormat('squads-vaults')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'squads-vaults' ? 'active-primary' : ''}`}
              >
                Squads v4 Vaults
              </button>
              <button
                type="button"
                onClick={() => setFormat('colon')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'colon' ? 'active-primary' : ''}`}
              >
                Address:Seed
              </button>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'csv' ? 'active-emerald' : ''}`}
              >
                Full CSV
              </button>
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'json' ? 'active-blue' : ''}`}
              >
                JSON Array
              </button>
              <button
                type="button"
                onClick={() => setFormat('python')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'python' ? 'active-amber' : ''}`}
              >
                Python Dict
              </button>
              <button
                type="button"
                onClick={() => setFormat('bash')}
                className={`tab-btn py-2 px-2 text-xs font-bold text-center ${format === 'bash' ? 'active-purple' : ''}`}
              >
                Bash Array
              </button>
            </div>
          </div>

          {/* Formatted Text Output Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-300">Generated Output Preview:</label>
              <span className="text-xs text-gray-400">{wallets.length} Wallets Formatted</span>
            </div>
            <textarea
              readOnly
              value={outputText}
              rows={8}
              className="input-field font-mono text-xs text-emerald-300/90 bg-[#080d1a] leading-relaxed selection:bg-purple-900/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleCopy}
              className="btn btn-secondary py-3 text-xs font-bold flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Formatted Text'}
            </button>

            <button
              onClick={handleDownload}
              className="btn btn-primary py-3 text-xs font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Output File
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
