import React, { useState, useRef } from 'react';
import type { ManagedWallet, WalletVersion, BlockchainType } from '../types';
import { TonService } from '../services/tonService';
import { SolanaService } from '../services/solanaService';
import { StorageService } from '../services/storageService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Sliders, 
  FileSpreadsheet, 
  FileCode, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Download,
  ArrowDown,
  ArrowUp,
  Layers,
  Send,
  Key
} from 'lucide-react';

interface MassGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletsCreated: (wallets: ManagedWallet[]) => void;
  onOpenAddressSheet?: (wallets: ManagedWallet[]) => void;
  initialChain?: BlockchainType;
}

export const MassGeneratorModal: React.FC<MassGeneratorModalProps> = ({
  isOpen,
  onClose,
  onWalletsCreated,
  onOpenAddressSheet,
  initialChain = 'ton',
}) => {
  const [chain, setChain] = useState<BlockchainType>(initialChain);
  const [count, setCount] = useState<number>(10);
  const [version, setVersion] = useState<WalletVersion>(initialChain === 'solana' ? 'solana-ed25519' : 'v4R2');
  const [tagPrefix, setTagPrefix] = useState<string>(initialChain === 'solana' ? 'Solana-Batch' : 'Batch-1');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [generatedWallets, setGeneratedWallets] = useState<ManagedWallet[]>([]);
  
  // Visibility & copy states
  const [revealedAll, setRevealedAll] = useState<boolean>(true);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedPrivId, setCopiedPrivId] = useState<string | null>(null);
  const [copiedAddrId, setCopiedAddrId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedAllAddresses, setCopiedAllAddresses] = useState<boolean>(false);

  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleSelectChain = (newChain: BlockchainType) => {
    setChain(newChain);
    if (newChain === 'solana') {
      setVersion('solana-ed25519');
      setTagPrefix('Solana-Batch');
    } else {
      setVersion('v4R2');
      setTagPrefix('Batch-1');
    }
  };

  const handleGenerate = async () => {
    const totalCount = Math.max(1, Math.min(1000, count));
    setIsGenerating(true);
    setProgress({ current: 0, total: totalCount });

    try {
      let wallets: ManagedWallet[] = [];

      if (chain === 'solana') {
        wallets = await SolanaService.generateBulkWallets(
          totalCount,
          version === 'squads-v4' ? 'squads-v4' : 'solana-ed25519',
          tagPrefix || 'Solana-Batch',
          (current, total) => {
            setProgress({ current, total });
          }
        );
      } else {
        wallets = await TonService.generateBulkWallets(
          totalCount,
          version,
          tagPrefix || 'Batch',
          698983191,
          (current, total) => {
            setProgress({ current, total });
          }
        );
      }

      // Automatically import all wallets into the app immediately
      onWalletsCreated(wallets);
      
      setGeneratedWallets(wallets);
      setRevealedIds(new Set(wallets.map(w => w.id)));
      setRevealedAll(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Error generating bulk wallets:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleReveal = (id: string) => {
    const next = new Set(revealedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setRevealedIds(next);
  };

  const handleToggleRevealAll = () => {
    if (revealedAll) {
      setRevealedIds(new Set());
      setRevealedAll(false);
    } else {
      setRevealedIds(new Set(generatedWallets.map(w => w.id)));
      setRevealedAll(true);
    }
  };

  const handleCopyKeyphrase = (id: string, mnemonic: string[]) => {
    navigator.clipboard.writeText(mnemonic.join(' '));
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCopyPrivateKey = (id: string, privKey: string) => {
    navigator.clipboard.writeText(privKey);
    setCopiedPrivId(id);
    setTimeout(() => setCopiedPrivId(null), 2000);
  };

  const handleCopyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddrId(id);
    setTimeout(() => setCopiedAddrId(null), 2000);
  };

  const handleCopyAllAddresses = () => {
    const text = generatedWallets.map(w => w.address).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAllAddresses(true);
    setTimeout(() => setCopiedAllAddresses(false), 2000);
  };

  const handleCopyAllKeyphrases = () => {
    const text = generatedWallets.map((w, idx) => 
      `#${idx + 1} [${w.label}]\nAddress: ${w.address}\nKeyphrase: ${w.mnemonic.join(' ')}\n${w.privateKey ? `Private Key (Base58): ${w.privateKey}\n` : ''}`
    ).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleScrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const handleScrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDone = () => {
    setGeneratedWallets([]);
    onClose();
  };

  const previewWallets = generatedWallets.slice(0, 50);

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-3xl max-h-[92vh] overflow-y-auto p-6 relative">
        <div ref={topRef} />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
              chain === 'solana'
                ? 'bg-gradient-to-tr from-[#9945FF] to-[#14F195] shadow-[#9945FF]/30'
                : 'bg-gradient-to-tr from-[#0098EA] to-[#00d2ff] shadow-[#0098EA]/30'
            }`}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Mass Wallet Generator (Up to 1,000)</h2>
              <p className="text-xs text-gray-400">Generate high-security TON & Solana (Squads v4) wallets in parallel</p>
            </div>
          </div>
          <button 
            onClick={handleDone}
            disabled={isGenerating}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Setup Configuration Options */}
        {generatedWallets.length === 0 ? (
          <div className="py-6 space-y-6">
            
            {/* Blockchain Selector Tabs */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Select Target Blockchain:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectChain('ton')}
                  className={`p-3.5 rounded-xl border transition-all text-left flex items-center gap-3 ${
                    chain === 'ton' 
                      ? 'bg-[#0098EA]/15 border-[#0098EA] shadow-md shadow-[#0098EA]/20' 
                      : 'bg-[#080d1a] border-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center font-bold">
                    💎
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">TON Blockchain</div>
                    <div className="text-[11px] text-gray-400">v4R2, W5 Gasless, v3R2</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectChain('solana')}
                  className={`p-3.5 rounded-xl border transition-all text-left flex items-center gap-3 ${
                    chain === 'solana' 
                      ? 'bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/15 border-[#14F195] shadow-md shadow-[#9945FF]/20' 
                      : 'bg-[#080d1a] border-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#9945FF]/20 text-[#14F195] flex items-center justify-center font-bold">
                    🟣
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm flex items-center gap-1.5">
                      <span>Solana Blockchain</span>
                      <span className="badge bg-[#9945FF]/30 text-[#14F195] text-[9px] px-1 py-0">Squads v4</span>
                    </div>
                    <div className="text-[11px] text-gray-400">Ed25519 & Squads Protocol v4</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quantity Selector with Presets up to 1000 */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-300">
                    Number of Wallets to Create:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={count}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setCount('' as any);
                        return;
                      }
                      const val = parseInt(raw);
                      if (!isNaN(val)) {
                        setCount(Math.max(1, Math.min(1000, val)));
                      }
                    }}
                    onBlur={() => {
                      if (!count || isNaN(Number(count))) {
                        setCount(10);
                      }
                    }}
                    className={`input-field w-24 text-center py-1 px-2 font-mono font-bold text-base ${
                      chain === 'solana' ? 'text-[#14F195]' : 'text-[#0098EA]'
                    }`}
                  />
                  <span className="text-xs text-gray-400 font-semibold">/ 1,000 max</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {[10, 50, 100, 250, 500, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCount(val)}
                      className={`tab-btn py-1 px-2 text-xs font-bold ${count === val ? 'active-primary' : ''}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={1000}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className={`w-full h-2.5 bg-[#121b30] rounded-lg appearance-none cursor-pointer ${
                  chain === 'solana' ? 'accent-[#14F195]' : 'accent-[#0098EA]'
                }`}
              />
            </div>

            {/* Contract / Architecture Selector */}
            {chain === 'ton' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Tonkeeper Smart Contract Version:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setVersion('v4R2')}
                    className={`tab-btn p-3 text-left transition-all ${version === 'v4R2' ? 'active-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">v4R2</span>
                      <span className="badge badge-primary">Default</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Standard Tonkeeper Wallet contract format</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersion('W5')}
                    className={`tab-btn p-3 text-left transition-all ${version === 'W5' ? 'active-purple' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">W5</span>
                      <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30">W5 Standard</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Tonkeeper W5 contract with gasless actions</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersion('v3R2')}
                    className={`tab-btn p-3 text-left transition-all ${version === 'v3R2' ? 'active-emerald' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">v3R2</span>
                      <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Legacy</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Legacy TON wallet contract format</p>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Solana Wallet Architecture & Protocol:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVersion('solana-ed25519')}
                    className={`tab-btn p-3 text-left transition-all ${version === 'solana-ed25519' ? 'active-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">Solana Ed25519 Keypair</span>
                      <span className="badge bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/30">Standard</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Native Solana keypairs with Base58 private keys and BIP44 24-word seed phrases
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersion('squads-v4')}
                    className={`tab-btn p-3 text-left transition-all ${version === 'squads-v4' ? 'active-purple' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>Squads Protocol v4 Vault</span>
                      </span>
                      <span className="badge bg-[#9945FF]/30 text-[#14F195] border border-[#9945FF]/40">Smart Account</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Derives Squads Protocol v4 Multisig & Vault PDAs with controlling keypair
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Tag / Label Prefix */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Batch Tag / Label Prefix:
              </label>
              <input
                type="text"
                value={tagPrefix}
                onChange={(e) => setTagPrefix(e.target.value)}
                placeholder="e.g. AirDrop, Staking, Vault"
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">
                Generated wallets will be named: <span className="text-white font-mono">{tagPrefix || 'Batch'} #1</span>, <span className="text-white font-mono">{tagPrefix || 'Batch'} #2</span>...
              </p>
            </div>

            {/* Progress Status if Generating */}
            {isGenerating && (
              <div className="bg-[#121b30] p-4 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Deriving cryptographically secure seeds, private keys & addresses...</span>
                  <span className={`font-bold font-mono ${chain === 'solana' ? 'text-[#14F195]' : 'text-[#0098EA]'}`}>
                    {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      chain === 'solana' 
                        ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195]' 
                        : 'bg-gradient-to-r from-[#0098EA] to-[#00d2ff]'
                    }`}
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`w-full btn py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-lg ${
                  chain === 'solana'
                    ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 text-white shadow-[#9945FF]/30'
                    : 'btn-primary shadow-[#0098EA]/20'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Generating {count} {chain.toUpperCase()} Wallets in Bulk ({progress.current}/{progress.total})...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Generate {count} {chain === 'solana' ? 'Solana (Squads v4)' : 'TON'} Wallets Now
                  </span>
                )}
              </button>
            </div>

          </div>
        ) : (
          /* Results View */
          <div className="py-6 space-y-5">
            
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    ✅ {generatedWallets.length} {generatedWallets[0]?.chain?.toUpperCase() || 'TON'} Wallets Saved to Vault!
                  </h4>
                  <p className="text-xs text-emerald-300/80">
                    All addresses, private keys, and seed phrases are safely secured in your studio.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScrollToBottom}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs text-[#0098EA] border-[#0098EA]/30 hover:bg-[#0098EA]/10 font-bold"
                  title="Scroll to bottom"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Bottom</span>
                </button>
                <button
                  onClick={() => setGeneratedWallets([])}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 shrink-0"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  New Batch
                </button>
              </div>
            </div>

            {/* Easy-To-Copy Address & Token Distribution Banner */}
            <div className="bg-gradient-to-r from-[#9945FF]/15 via-[#14F195]/15 to-[#121b30] p-4 rounded-2xl border border-[#9945FF]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-[#14F195]" />
                  <span>Ready to Distribute Tokens?</span>
                </div>
                <p className="text-xs text-gray-300">
                  Open the Easy Address View to copy all addresses in 1 click or disperse tokens to all of them.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyAllAddresses}
                  className="btn btn-secondary btn-sm text-xs font-bold flex items-center gap-1.5 text-white border-white/20 hover:bg-white/10"
                >
                  {copiedAllAddresses ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAllAddresses ? 'Addresses Copied!' : 'Copy Addresses (Lines)'}</span>
                </button>

                {onOpenAddressSheet && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAddressSheet(generatedWallets);
                      onClose();
                    }}
                    className="btn bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 text-white font-bold py-1.5 px-3 text-xs flex items-center gap-1.5 shadow-md shadow-[#9945FF]/30"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Easy Address View</span>
                  </button>
                )}
              </div>
            </div>

            {/* Action Bar (Reveal Toggle + Copy All + Export Formats) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#080d1a] p-3 rounded-xl border border-white/10">
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleRevealAll}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs text-gray-300"
                >
                  {revealedAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {revealedAll ? 'Hide Phrases & Keys' : 'Reveal Phrases & Keys'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllKeyphrases}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs text-amber-400"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAll ? 'All Credentials Copied!' : `Copy All (${generatedWallets.length})`}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => StorageService.exportToCSV(generatedWallets)}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1 text-emerald-400 font-bold"
                  title="Download CSV Backup"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  CSV
                </button>

                <button
                  onClick={() => StorageService.exportToJSON(generatedWallets)}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1 text-blue-400 font-bold"
                  title="Download JSON Backup"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  JSON
                </button>

                <button
                  onClick={() => StorageService.exportPrivateKeysTXT(generatedWallets)}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1 text-amber-400 font-bold"
                  title="Download Private Keys TXT"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Keys TXT
                </button>

                <button
                  onClick={() => StorageService.exportPairsTXT(generatedWallets)}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1 text-gray-300 font-bold"
                  title="Download Keyphrase + Address Recovery TXT"
                >
                  <Download className="w-3.5 h-3.5" />
                  TXT
                </button>
              </div>

            </div>

            {/* Note if total > 50 */}
            {generatedWallets.length > 50 && (
              <div className="text-xs text-gray-400 bg-[#121b30] px-3.5 py-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span>Displaying first 50 wallets in preview.</span>
                <span className="text-emerald-400 font-bold">All {generatedWallets.length} wallets saved & ready in studio!</span>
              </div>
            )}

            {/* Generated Wallets List */}
            <div className="max-h-[360px] overflow-y-auto space-y-3.5 pr-1">
              {previewWallets.map((w, idx) => {
                const isRevealed = revealedIds.has(w.id);
                const isSolanaWallet = w.chain === 'solana' || w.version === 'solana-ed25519' || w.version === 'squads-v4';
                return (
                  <div 
                    key={w.id} 
                    className="bg-[#080d1a] border border-white/10 p-4 rounded-2xl space-y-3 transition-all hover:border-white/20 shadow-sm"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs border ${
                          isSolanaWallet 
                            ? 'bg-[#9945FF]/20 text-[#14F195] border-[#14F195]/30' 
                            : 'bg-[#121b30] text-[#0098EA] border-[#0098EA]/30'
                        }`}>
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-white text-sm">{w.label}</h4>
                        <span className={`badge ${isSolanaWallet ? 'bg-[#9945FF]/20 text-[#14F195]' : 'badge-primary'}`}>
                          {w.version}
                        </span>
                        {w.squadsVaultAddress && (
                          <span className="badge bg-[#9945FF]/30 text-[#14F195] border border-[#14F195]/20 text-[10px]">
                            Squads v4
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleReveal(w.id)}
                          className="btn btn-secondary btn-sm px-2.5 py-1 text-xs text-gray-400 hover:text-white"
                          title={isRevealed ? 'Hide credentials' : 'Show credentials'}
                        >
                          {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span className="text-[11px]">{isRevealed ? 'Hide' : 'Reveal'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyKeyphrase(w.id, w.mnemonic)}
                          className="btn btn-secondary btn-sm px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300"
                          title="Copy seed phrase"
                        >
                          {copiedKeyId === w.id ? <Check className="w-3 h-3 text-emerald-400" /> : <KeyRound className="w-3 h-3" />}
                          <span className="text-[11px]">{copiedKeyId === w.id ? 'Copied' : 'Copy Seed'}</span>
                        </button>

                        {w.privateKey && (
                          <button
                            type="button"
                            onClick={() => handleCopyPrivateKey(w.id, w.privateKey!)}
                            className="btn btn-secondary btn-sm px-2.5 py-1 text-xs text-[#14F195] hover:bg-[#14F195]/10"
                            title="Copy Base58 Private Key"
                          >
                            {copiedPrivId === w.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Key className="w-3 h-3" />}
                            <span className="text-[11px]">{copiedPrivId === w.id ? 'Copied' : 'Copy Key'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Derived Address */}
                    <div className="bg-[#121b30] p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-gray-500 font-semibold text-[10px]">ADDR:</span>
                        <span className="text-gray-300 font-mono text-[11px] truncate">
                          {w.address}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(w.id, w.address)}
                        className="text-gray-300 hover:text-white flex items-center gap-1 shrink-0 text-[11px] font-semibold"
                        title="Copy Address"
                      >
                        {copiedAddrId === w.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedAddrId === w.id ? 'Copied' : 'Copy Address'}</span>
                      </button>
                    </div>

                    {/* Squads v4 Vault PDA (if present) */}
                    {w.squadsVaultAddress && (
                      <div className="bg-[#0f172a] p-2 rounded-xl border border-[#9945FF]/30 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-[#14F195] font-semibold text-[10px]">SQDS VAULT:</span>
                          <span className="text-gray-300 font-mono text-[11px] truncate">
                            {w.squadsVaultAddress}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(`${w.id}_vault`, w.squadsVaultAddress!)}
                          className="text-[#14F195] hover:underline flex items-center gap-1 shrink-0 text-[11px]"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Vault</span>
                        </button>
                      </div>
                    )}

                    {/* Base58 Private Key (if Solana) */}
                    {w.privateKey && isRevealed && (
                      <div className="bg-[#050811] p-2.5 rounded-xl border border-[#14F195]/20 flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <span className="text-amber-400 font-semibold text-[10px] mr-1.5">PRIVATE KEY (Base58):</span>
                          <span className="text-gray-200 font-mono text-[11px] select-all">
                            {w.privateKey}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPrivateKey(w.id, w.privateKey!)}
                          className="text-[#14F195] hover:text-[#14F195]/80 flex items-center gap-1 shrink-0 text-[11px] font-semibold"
                        >
                          {copiedPrivId === w.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedPrivId === w.id ? 'Copied' : 'Copy Key'}</span>
                        </button>
                      </div>
                    )}

                    {/* Seed Phrase Display Grid */}
                    {isRevealed ? (
                      <div className="bg-[#050811] p-3 rounded-xl border border-amber-500/20">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                          {w.mnemonic.map((word, wIdx) => (
                            <div 
                              key={wIdx}
                              className="bg-[#121b30] px-2 py-1 rounded-lg border border-white/5 flex items-center gap-1.5 text-xs"
                            >
                              <span className="font-mono text-[10px] text-gray-500 w-4 text-right">{wIdx + 1}.</span>
                              <span className="font-mono font-bold text-amber-300 truncate">{word}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#050811] p-2.5 rounded-xl border border-white/5 text-center text-xs text-gray-500 font-mono">
                        •••••••••••••••••••••••• (Credentials hidden)
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Row */}
            <div ref={bottomRef} className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleScrollToTop}
                className="btn btn-secondary py-3.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 text-gray-300 hover:text-white"
                title="Scroll back to top"
              >
                <ArrowUp className="w-4 h-4" />
                <span>Top</span>
              </button>

              <button
                onClick={handleDone}
                className="flex-1 btn btn-primary py-3.5 text-base font-bold shadow-lg shadow-[#0098EA]/30 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>Return to Dashboard ({generatedWallets.length} Wallets Saved)</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
