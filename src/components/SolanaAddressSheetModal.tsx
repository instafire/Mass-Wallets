import React, { useState, useMemo } from 'react';
import type { ManagedWallet } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  Copy, 
  Check, 
  Send, 
  Download, 
  Search, 
  Layers, 
  ShieldCheck, 
  Sparkles,
  Key,
  QrCode,
  ExternalLink
} from 'lucide-react';

interface SolanaAddressSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  onOpenDistributeToThese?: (wallets: ManagedWallet[]) => void;
}

export const SolanaAddressSheetModal: React.FC<SolanaAddressSheetModalProps> = ({
  isOpen,
  onClose,
  wallets,
  onOpenDistributeToThese,
}) => {
  const [viewFormat, setViewFormat] = useState<'lines' | 'comma' | 'json' | 'pairs' | 'squads' | 'csv'>('lines');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [showPrivateKeyInPairs, setShowPrivateKeyInPairs] = useState<boolean>(false);
  const [qrPreviewWallet, setQrPreviewWallet] = useState<ManagedWallet | null>(null);

  // Filter only Solana wallets if mixed, or all if all are Solana
  const solanaWallets = useMemo(() => {
    return wallets.filter(w => w.chain === 'solana' || w.version === 'solana-ed25519' || w.version === 'squads-v4');
  }, [wallets]);

  // Search filter
  const filteredWallets = useMemo(() => {
    if (!searchTerm.trim()) return solanaWallets;
    const term = searchTerm.toLowerCase().trim();
    return solanaWallets.filter(w => 
      w.address.toLowerCase().includes(term) ||
      w.label.toLowerCase().includes(term) ||
      w.tag.toLowerCase().includes(term) ||
      (w.squadsVaultAddress && w.squadsVaultAddress.toLowerCase().includes(term))
    );
  }, [solanaWallets, searchTerm]);

  // Generated Text for Easy Copying
  const formattedText = useMemo(() => {
    if (viewFormat === 'lines') {
      return filteredWallets.map(w => w.address).join('\n');
    }
    if (viewFormat === 'comma') {
      return filteredWallets.map(w => w.address).join(', ');
    }
    if (viewFormat === 'json') {
      return JSON.stringify(filteredWallets.map(w => w.address), null, 2);
    }
    if (viewFormat === 'pairs') {
      return filteredWallets.map(w => 
        showPrivateKeyInPairs 
          ? `${w.address}:${w.privateKey || w.mnemonic.join(' ')}`
          : `${w.address}:${w.label}`
      ).join('\n');
    }
    if (viewFormat === 'squads') {
      return filteredWallets
        .filter(w => w.squadsVaultAddress)
        .map(w => `${w.address} -> Squads Vault: ${w.squadsVaultAddress}`)
        .join('\n');
    }
    if (viewFormat === 'csv') {
      const header = 'Index,Label,Tag,Address,SOL_Balance,Tokens,Squads_Vault\n';
      const rows = filteredWallets.map((w, idx) => {
        const tokensStr = (w.jettons || []).filter(j => parseFloat(j.balance || '0') > 0 && j.symbol !== 'SOL').map(j => `${j.balance} ${j.symbol}`).join('; ');
        return `${idx + 1},"${w.label}","${w.tag}",${w.address},${w.balance},"${tokensStr}",${w.squadsVaultAddress || ''}`;
      }).join('\n');
      return header + rows;
    }
    return '';
  }, [filteredWallets, viewFormat, showPrivateKeyInPairs]);

  if (!isOpen) return null;

  const handleCopyText = (type: string) => {
    navigator.clipboard.writeText(formattedText);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopySingle = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRowId(id);
    setTimeout(() => setCopiedRowId(null), 2000);
  };

  const handleDownloadFile = () => {
    const ext = viewFormat === 'json' ? 'json' : 'txt';
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solana_addresses_${viewFormat}_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDistribute = () => {
    if (onOpenDistributeToThese) {
      onOpenDistributeToThese(filteredWallets);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-4xl max-h-[92vh] overflow-y-auto p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-md shadow-[#9945FF]/30">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Solana Address & Distribution Sheet</h2>
                <span className="badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30 text-xs px-2 py-0.5 font-mono">
                  {solanaWallets.length} Wallets
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Easy-to-copy address view for batch funding, airdrops, and Squads v4 multisig vaults
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Bar: Distribute + Copy All */}
        <div className="py-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-[#9945FF]/15 via-[#14F195]/10 to-[#121b30] rounded-2xl border border-[#9945FF]/30">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#14F195]" />
                <span>Ready for Token Distribution</span>
              </div>
              <p className="text-xs text-gray-300">
                Copy all addresses to your clipboard or launch the mass token distributor directly.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyText('all-main')}
                className="btn btn-secondary py-2.5 px-3.5 text-xs font-bold flex items-center gap-1.5 text-[#14F195] border border-[#14F195]/30 hover:bg-[#14F195]/10"
              >
                {copiedType === 'all-main' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedType === 'all-main' ? 'Copied All!' : `Copy All (${filteredWallets.length})`}</span>
              </button>

              {onOpenDistributeToThese && (
                <button
                  type="button"
                  onClick={handleDistribute}
                  className="btn bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 text-white font-bold py-2.5 px-4 text-xs flex items-center gap-2 shadow-lg shadow-[#9945FF]/30"
                >
                  <Send className="w-4 h-4" />
                  <span>Distribute Tokens to All</span>
                </button>
              )}
            </div>
          </div>

          {/* Format Selector & Search Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#080d1a] p-3 rounded-xl border border-white/10">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-400 mr-1">Format:</span>
              <button
                type="button"
                onClick={() => setViewFormat('lines')}
                className={`tab-btn py-1 px-2.5 text-xs font-bold ${viewFormat === 'lines' ? 'active-primary' : ''}`}
              >
                One Per Line
              </button>
              <button
                type="button"
                onClick={() => setViewFormat('comma')}
                className={`tab-btn py-1 px-2.5 text-xs font-bold ${viewFormat === 'comma' ? 'active-primary' : ''}`}
              >
                Comma-Separated
              </button>
              <button
                type="button"
                onClick={() => setViewFormat('json')}
                className={`tab-btn py-1 px-2.5 text-xs font-bold ${viewFormat === 'json' ? 'active-primary' : ''}`}
              >
                JSON Array
              </button>
              <button
                type="button"
                onClick={() => setViewFormat('pairs')}
                className={`tab-btn py-1 px-2.5 text-xs font-bold ${viewFormat === 'pairs' ? 'active-primary' : ''}`}
              >
                Address:Key
              </button>
              <button
                type="button"
                onClick={() => setViewFormat('squads')}
                className={`tab-btn py-1 px-2.5 text-xs font-bold ${viewFormat === 'squads' ? 'active-purple' : ''}`}
              >
                Squads v4 Vaults
              </button>
              <button
                type="button"
                onClick={() => setViewFormat('csv')}
                className={`tab-btn py-1 px-2.5 text-xs font-bold ${viewFormat === 'csv' ? 'active-primary' : ''}`}
              >
                CSV Table
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter addresses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field text-xs pl-8 pr-2.5 py-1 w-44 bg-[#121b30]"
                />
              </div>

              <button
                type="button"
                onClick={handleDownloadFile}
                className="btn btn-secondary btn-sm text-xs flex items-center gap-1 text-gray-300 hover:text-white"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Toggle for Private Key view when in 'pairs' format */}
          {viewFormat === 'pairs' && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 shrink-0" />
                <span>Pair format: includes private keys for scripts/bots. Keep private keys secure!</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivateKeyInPairs(!showPrivateKeyInPairs)}
                className="btn btn-secondary btn-sm py-1 px-2 text-xs text-amber-300 border-amber-500/40"
              >
                {showPrivateKeyInPairs ? 'Hide Private Keys' : 'Reveal Private Keys'}
              </button>
            </div>
          )}

          {/* Large Copyable Text Area */}
          <div className="relative">
            <textarea
              readOnly
              value={formattedText}
              rows={8}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className="w-full bg-[#050811] text-[#14F195] font-mono text-xs p-3.5 rounded-xl border border-white/10 focus:border-[#14F195]/50 focus:outline-none resize-y selection:bg-[#9945FF]/40"
              placeholder="No Solana addresses match your filter"
            />
            <button
              type="button"
              onClick={() => handleCopyText('textarea-copy')}
              className="absolute top-2.5 right-2.5 btn btn-secondary btn-sm text-xs flex items-center gap-1 bg-[#121b30]/80 backdrop-blur-sm border-white/20 hover:text-white"
              title="Copy text content"
            >
              {copiedType === 'textarea-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedType === 'textarea-copy' ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Detailed Interactive Table */}
          <div>
            <div className="flex items-center justify-between pb-2 pt-1 text-xs text-gray-400 font-semibold">
              <span>Interactive Address List ({filteredWallets.length} addresses)</span>
              <span>Click any address to copy immediately</span>
            </div>

            <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
              {filteredWallets.map((w, idx) => {
                const isCopied = copiedRowId === w.id;
                const isSquads = w.version === 'squads-v4' || !!w.squadsVaultAddress;
                return (
                  <div 
                    key={w.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[#080d1a] hover:bg-[#121b30] rounded-xl border border-white/5 transition-all text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-[#121b30] text-gray-400 flex items-center justify-center font-mono text-[10px] shrink-0 border border-white/10">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs truncate">{w.label}</span>
                          {isSquads && (
                            <span className="badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/20 text-[10px] py-0 px-1.5 font-bold">
                              Squads v4
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400 font-mono">
                            {w.balance} SOL
                          </span>
                          {w.jettons && w.jettons.filter(j => parseFloat(j.balance || '0') > 0 && j.symbol !== 'SOL').map(j => (
                            <span key={j.symbol} className="text-[10px] text-amber-300 font-mono bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.2 rounded font-semibold">
                              {j.balance} {j.symbol}
                            </span>
                          ))}
                        </div>
                        <div className="font-mono text-gray-300 text-[11px] truncate flex items-center gap-1">
                          <span className="text-gray-400">Addr:</span>
                          <span className="select-all">{w.address}</span>
                        </div>
                        {w.squadsVaultAddress && (
                          <div className="font-mono text-[#14F195]/80 text-[10px] truncate flex items-center gap-1">
                            <span className="text-gray-500">Vault:</span>
                            <span className="select-all">{w.squadsVaultAddress}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setQrPreviewWallet(w)}
                        className="btn btn-secondary btn-sm py-1 px-2 text-xs text-[#14F195] hover:bg-[#14F195]/10 flex items-center gap-1"
                        title="Show Pump.fun Scannable QR Code"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopySingle(w.id, w.address)}
                        className="btn btn-secondary btn-sm py-1 px-2.5 text-xs text-gray-300 hover:text-white flex items-center gap-1"
                        title="Copy Solana Address"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>

                      {w.squadsVaultAddress && (
                        <button
                          type="button"
                          onClick={() => handleCopySingle(`${w.id}_vault`, w.squadsVaultAddress!)}
                          className="btn btn-secondary btn-sm py-1 px-2 text-[11px] text-[#14F195] hover:bg-[#14F195]/10 flex items-center gap-1"
                          title="Copy Squads v4 Vault PDA"
                        >
                          {copiedRowId === `${w.id}_vault` ? <Check className="w-3 h-3 text-emerald-400" /> : <ShieldCheck className="w-3 h-3" />}
                          <span>Vault PDA</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Quick QR Code Popover Modal for Pump.fun App Scanning */}
      {qrPreviewWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="glass-card max-w-sm w-full p-6 border border-white/20 shadow-2xl relative space-y-4 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-left">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#14F195]/20 text-[#14F195] flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{qrPreviewWallet.label}</h3>
                  <p className="text-[11px] text-[#14F195] font-mono">Pump.fun Compatible QR</p>
                </div>
              </div>
              <button
                onClick={() => setQrPreviewWallet(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-xl inline-block mx-auto border-2 border-[#14F195]/40">
              <QRCodeSVG
                value={qrPreviewWallet.address}
                size={190}
                level="M"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-semibold text-gray-400 block">Solana Address (Base58):</label>
              <div className="bg-[#080d1a] p-2.5 rounded-xl border border-white/10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-gray-200 truncate select-all">
                  {qrPreviewWallet.address}
                </span>
                <button
                  onClick={() => handleCopySingle(qrPreviewWallet.id, qrPreviewWallet.address)}
                  className="p-1.5 rounded-lg text-[#14F195] hover:text-white bg-white/5 hover:bg-white/10 transition-all shrink-0"
                  title="Copy Address"
                >
                  {copiedRowId === qrPreviewWallet.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleCopySingle(qrPreviewWallet.id, qrPreviewWallet.address)}
                className="btn btn-secondary btn-sm py-2 text-xs flex items-center justify-center gap-1.5"
              >
                {copiedRowId === qrPreviewWallet.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#14F195]" />}
                <span>{copiedRowId === qrPreviewWallet.id ? 'Copied!' : 'Copy Address'}</span>
              </button>
              <a
                href={`https://solscan.io/account/${qrPreviewWallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm py-2 text-xs flex items-center justify-center gap-1.5 text-gray-300 hover:text-white"
              >
                <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                <span>Solscan</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
