import React, { useState } from 'react';
import type { ManagedWallet, WalletVersion, BlockchainType } from '../types';
import { TonService } from '../services/tonService';
import { SolanaService } from '../services/solanaService';
import confetti from 'canvas-confetti';
import { X, Upload, FileText, ShieldCheck } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletsImported: (importedWallets: ManagedWallet[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onWalletsImported,
}) => {
  const [targetChain, setTargetChain] = useState<BlockchainType | 'auto'>('auto');
  const [inputText, setInputText] = useState<string>('');
  const [version, setVersion] = useState<WalletVersion>('v4R2');
  const [tag, setTag] = useState<string>('Imported');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!inputText.trim()) {
      setErrorMsg('Please enter or upload seed phrases, private keys, CSV, or JSON backup file');
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const wallets: ManagedWallet[] = [];
      const trimmed = inputText.trim();

      // 1. Check if input is JSON (Master Backup Object, Array, or Solana CLI keypair array)
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);

          // Check if it's a Solana CLI JSON byte array [12, 45, 98, ...]
          if (Array.isArray(parsed) && parsed.length >= 32 && typeof parsed[0] === 'number') {
            const solWallet = SolanaService.importWalletFromPrivateKey(
              trimmed,
              'solana-ed25519',
              `${tag} #1`,
              tag
            );
            wallets.push(solWallet);
          } else {
            const list: any[] = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed.wallets)
                ? parsed.wallets
                : (parsed.mnemonic || parsed.seed || parsed.phrase || parsed.privateKey || parsed['24-Word Keyphrase'])
                  ? [parsed]
                  : [];

            if (list.length > 0) {
              for (let idx = 0; idx < list.length; idx++) {
                const item = list[idx];
                const mnemonicStr = item.mnemonic || item.seed || item.phrase || item['24-Word Keyphrase'];
                const privKey = item.privateKey || item.secretKey;
                const isSolana = targetChain === 'solana' || item.chain === 'solana' || item.version?.startsWith('solana') || item.version === 'squads-v4';

                if (privKey && isSolana) {
                  const wallet = SolanaService.importWalletFromPrivateKey(
                    privKey,
                    item.version || 'solana-ed25519',
                    item.label || `${tag} #${idx + 1}`,
                    item.tag || tag
                  );
                  if (item.isMainWallet) wallet.isMainWallet = true;
                  wallets.push(wallet);
                } else if (mnemonicStr) {
                  if (isSolana) {
                    const wallet = await SolanaService.importWalletFromMnemonic(
                      mnemonicStr,
                      item.version || 'solana-ed25519',
                      item.label || `${tag} #${idx + 1}`,
                      item.tag || tag
                    );
                    if (item.isMainWallet) wallet.isMainWallet = true;
                    wallets.push(wallet);
                  } else {
                    const wallet = await TonService.importWalletFromMnemonic(
                      mnemonicStr,
                      item.version || version,
                      item.label || `${tag} #${idx + 1}`,
                      item.tag || tag,
                      item.subwalletId
                    );
                    if (item.isMainWallet) wallet.isMainWallet = true;
                    wallets.push(wallet);
                  }
                }
              }
            }
          }
        } catch (jsonErr) {
          console.warn('JSON parse attempt failed, falling back to line parsing:', jsonErr);
        }
      }

      // 2. Check if CSV format
      if (wallets.length === 0 && (trimmed.includes(',') || trimmed.includes('\t'))) {
        const rows = trimmed.split('\n').filter(r => r.trim().length > 0);
        if (rows.length > 0) {
          const delimiter = rows[0].includes('\t') ? '\t' : ',';
          const headers = rows[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
          const headerIndexMnemonic = headers.findIndex(h => h.includes('mnemonic') || h.includes('keyphrase') || h.includes('phrase') || h.includes('seed'));
          const headerIndexPrivate = headers.findIndex(h => h.includes('private') || h.includes('secret'));
          const headerIndexLabel = headers.findIndex(h => h === 'label' || h.includes('name'));
          const headerIndexTag = headers.findIndex(h => h === 'tag' || h.includes('category'));
          const headerIndexChain = headers.findIndex(h => h.includes('chain'));
          const headerIndexVersion = headers.findIndex(h => h === 'version');

          const startRow = (headerIndexMnemonic !== -1 || headerIndexPrivate !== -1) ? 1 : 0;
          for (let r = startRow; r < rows.length; r++) {
            const cols = rows[r].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
            const seedCandidate = headerIndexMnemonic !== -1 ? cols[headerIndexMnemonic] : undefined;
            const privCandidate = headerIndexPrivate !== -1 ? cols[headerIndexPrivate] : undefined;
            const chainVal = headerIndexChain !== -1 ? cols[headerIndexChain]?.toLowerCase() : targetChain;
            const customLabel = headerIndexLabel !== -1 && cols[headerIndexLabel] ? cols[headerIndexLabel] : `${tag} #${wallets.length + 1}`;
            const customTag = headerIndexTag !== -1 && cols[headerIndexTag] ? cols[headerIndexTag] : tag;
            const customVer = headerIndexVersion !== -1 && cols[headerIndexVersion] ? cols[headerIndexVersion] : version;

            if (privCandidate && (chainVal === 'solana' || targetChain === 'solana')) {
              try {
                const wallet = SolanaService.importWalletFromPrivateKey(
                  privCandidate,
                  customVer as WalletVersion,
                  customLabel,
                  customTag
                );
                wallets.push(wallet);
              } catch (e) {
                console.warn('Error importing private key row:', e);
              }
            } else if (seedCandidate) {
              const words = seedCandidate.split(/\s+/);
              if (words.length === 12 || words.length === 24) {
                if (chainVal === 'solana') {
                  const wallet = await SolanaService.importWalletFromMnemonic(
                    words,
                    (customVer.startsWith('solana') || customVer === 'squads-v4' ? customVer : 'solana-ed25519') as WalletVersion,
                    customLabel,
                    customTag
                  );
                  wallets.push(wallet);
                } else {
                  const wallet = await TonService.importWalletFromMnemonic(
                    words,
                    customVer as WalletVersion,
                    customLabel,
                    customTag
                  );
                  wallets.push(wallet);
                }
              }
            }
          }
        }
      }

      // 3. Fallback: Parse line by line
      if (wallets.length === 0) {
        const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Mnemonics can't be auto-detected: the same 12/24 words derive
        // DIFFERENT addresses on TON vs Solana. Silently routing them to TON
        // made Solana funds "disappear". Require an explicit chain choice.
        if (targetChain === 'auto') {
          const hasMnemonicLine = lines.some(l => {
            const w = l.replace(/^\d+[\.\)]\s*/, '').split(/\s+/).filter(x => x.length > 0);
            return w.length === 12 || w.length === 24;
          });
          if (hasMnemonicLine) {
            setErrorMsg('Seed phrases found, but chain is set to Auto — the same words make different wallets on TON vs Solana. Please select TON or Solana above, then import again.');
            setIsImporting(false);
            return;
          }
        }

        for (let idx = 0; idx < lines.length; idx++) {
          let line = lines[idx];
          
          // Address:Secret format
          if (line.includes(':') && !line.startsWith('http')) {
            const parts = line.split(':');
            line = parts.slice(1).join(':').trim();
          }

          // Case A: Base58 Solana private key (length 43-88, base58 chars)
          const isBase58Key = /^[1-9A-HJ-NP-za-km-z]{43,88}$/.test(line);
          if (isBase58Key || (targetChain === 'solana' && !line.includes(' '))) {
            try {
              const wallet = SolanaService.importWalletFromPrivateKey(
                line,
                'solana-ed25519',
                `${tag} #${wallets.length + 1}`,
                tag
              );
              wallets.push(wallet);
              continue;
            } catch {
              // fallback to words check
            }
          }

          // Case B: Seed words
          const cleanedLine = line.replace(/^\d+[\.\)]\s*/, '');
          const words = cleanedLine.split(/\s+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);

          if (words.length === 12 || words.length === 24) {
            if (targetChain === 'solana') {
              const wallet = await SolanaService.importWalletFromMnemonic(
                words,
                'solana-ed25519',
                `${tag} #${wallets.length + 1}`,
                tag
              );
              wallets.push(wallet);
            } else {
              const wallet = await TonService.importWalletFromMnemonic(
                words,
                version,
                `${tag} #${wallets.length + 1}`,
                tag
              );
              wallets.push(wallet);
            }
          }
        }
      }

      if (wallets.length === 0) {
        setErrorMsg('No valid seed phrases or Base58 private keys found in input. Please check format.');
        setIsImporting(false);
        return;
      }

      onWalletsImported(wallets);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setInputText('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to import credentials.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Import Wallets & Keys</h2>
              <p className="text-xs text-gray-400">Import TON or Solana wallets via Seed Phrases, Base58 Private Keys, JSON, or CSV</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          
          {/* Target Chain Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Target Blockchain:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetChain('auto')}
                className={`tab-btn py-1.5 px-2 text-xs font-bold text-center ${targetChain === 'auto' ? 'active-primary' : ''}`}
              >
                Auto-Detect
              </button>
              <button
                type="button"
                onClick={() => setTargetChain('ton')}
                className={`tab-btn py-1.5 px-2 text-xs font-bold text-center ${targetChain === 'ton' ? 'active-primary' : ''}`}
              >
                💎 TON
              </button>
              <button
                type="button"
                onClick={() => setTargetChain('solana')}
                className={`tab-btn py-1.5 px-2 text-xs font-bold text-center ${targetChain === 'solana' ? 'active-purple' : ''}`}
              >
                🟣 Solana (Squads v4)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-300">
              Paste Seed Phrases, Base58 Private Keys, JSON Backup, or CSV:
            </label>
            <label className="cursor-pointer text-xs text-[#0098EA] hover:underline flex items-center gap-1 font-semibold">
              <FileText className="w-3.5 h-3.5" />
              Upload Backup File (.json / .csv / .txt)
              <input 
                type="file" 
                accept=".txt,.json,.csv" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={7}
            placeholder={`Paste 24-word seed phrases, Solana Base58 private keys, or JSON backup...`}
            className="input-field font-mono text-xs text-emerald-300/90 leading-relaxed selection:bg-purple-900/50"
          />

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Contract Format (if TON):
              </label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value as WalletVersion)}
                className="input-field py-2 text-xs font-bold"
              >
                <option value="v4R2">v4R2 (Standard Tonkeeper)</option>
                <option value="W5">W5 (Tonkeeper Next-Gen)</option>
                <option value="v3R2">v3R2 (Legacy TON)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Category Tag:
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Imported"
                className="input-field py-2 text-xs"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Action */}
          <div className="pt-2">
            <button
              onClick={handleImport}
              disabled={isImporting || !inputText.trim()}
              className="w-full btn btn-primary py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#0098EA]/30"
            >
              {isImporting ? (
                <span>Deriving & Importing Wallets...</span>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Import All Wallets to Studio</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
