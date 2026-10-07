import React, { useState } from 'react';
import type { ManagedWallet, WalletVersion, BlockchainType } from '../types';
import { TonService } from '../services/tonService';
import { SolanaService } from '../services/solanaService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Crown, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  ShieldCheck, 
  KeyRound,
  Eye,
  EyeOff,
  Layers,
  Shield
} from 'lucide-react';

interface CreateVaultWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVaultCreated: (wallet: ManagedWallet) => void;
}

export const CreateVaultWalletModal: React.FC<CreateVaultWalletModalProps> = ({
  isOpen,
  onClose,
  onVaultCreated,
}) => {
  const [chain, setChain] = useState<BlockchainType>('ton');
  const [version, setVersion] = useState<WalletVersion>('v4R2');
  const [label, setLabel] = useState<string>('TON Master Treasury');
  const [tag, setTag] = useState<string>('Vault-TON');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [createdVault, setCreatedVault] = useState<ManagedWallet | null>(null);
  
  const [isRevealed, setIsRevealed] = useState<boolean>(true);
  const [copiedPhrase, setCopiedPhrase] = useState<boolean>(false);
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);
  const [copiedVaultPda, setCopiedVaultPda] = useState<boolean>(false);
  const [fileDownloaded, setFileDownloaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectChain = (newChain: BlockchainType) => {
    setChain(newChain);
    if (newChain === 'solana') {
      setVersion('solana-ed25519');
      setLabel('Solana Master Treasury');
      setTag('Vault-SOL');
    } else {
      setVersion('v4R2');
      setLabel('TON Master Treasury');
      setTag('Vault-TON');
    }
  };

  const handleGenerateVault = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      let wallet: ManagedWallet;

      if (chain === 'solana') {
        wallet = await SolanaService.createWallet(
          version === 'squads-v4' ? 'squads-v4' : 'solana-ed25519',
          label || 'Solana Master Treasury',
          tag || 'Vault-SOL',
          24
        );
      } else {
        wallet = await TonService.createWallet(
          version as 'v4R2' | 'v3R2' | 'W5',
          label || 'TON Master Treasury',
          tag || 'Vault-TON',
          698983191
        );
      }

      wallet.isMainWallet = true;
      wallet.chain = chain;
      setCreatedVault(wallet);

      // Auto-trigger backup download to local drive
      downloadVaultBackupFile(wallet);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Error creating vault wallet:', err);
      setError(err?.message || 'Failed to generate vault wallet.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadVaultBackupFile = (wallet: ManagedWallet) => {
    const isSol = wallet.chain === 'solana' || wallet.version === 'solana-ed25519' || wallet.version === 'squads-v4';
    const backupData = {
      type: isSol ? 'SOLANA_MASTER_VAULT_BACKUP' : 'TON_MASTER_VAULT_BACKUP',
      chain: isSol ? 'solana' : 'ton',
      version: wallet.version,
      label: wallet.label,
      tag: wallet.tag,
      address: wallet.address,
      rawAddress: wallet.rawAddress || wallet.address,
      publicKey: wallet.publicKey,
      squadsVaultAddress: wallet.squadsVaultAddress,
      mnemonic: wallet.mnemonic.join(' '),
      mnemonicWords: wallet.mnemonic,
      createdAt: new Date(wallet.createdAt).toISOString(),
      isMainWallet: true,
      note: `Master Vault Treasury (${isSol ? 'Solana' : 'TON'}) Wallet Backup - Keep this 24-word phrase safe and secret.`,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master_vault_${isSol ? 'solana' : 'ton'}_${wallet.version}_${wallet.address.substring(0, 8)}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFileDownloaded(true);
  };

  const handleCopyPhrase = () => {
    if (!createdVault) return;
    navigator.clipboard.writeText(createdVault.mnemonic.join(' '));
    setCopiedPhrase(true);
    setTimeout(() => setCopiedPhrase(false), 2000);
  };

  const handleCopyAddress = () => {
    if (!createdVault) return;
    navigator.clipboard.writeText(createdVault.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleCopyVaultPda = () => {
    if (!createdVault?.squadsVaultAddress) return;
    navigator.clipboard.writeText(createdVault.squadsVaultAddress);
    setCopiedVaultPda(true);
    setTimeout(() => setCopiedVaultPda(false), 2000);
  };

  const handleFinishAndSave = () => {
    if (!createdVault) return;
    onVaultCreated(createdVault);
    setCreatedVault(null);
    onClose();
  };

  const getVersionDisplayName = (v: WalletVersion) => {
    switch (v) {
      case 'v4R2': return 'v4R2';
      case 'W5': return 'W5 (v5R1)';
      case 'v3R2': return 'v3R2';
      case 'solana-ed25519': return 'Ed25519';
      case 'squads-v4': return 'Squads v4';
      default: return v;
    }
  };

  const isSolana = createdVault 
    ? (createdVault.chain === 'solana' || createdVault.version === 'solana-ed25519' || createdVault.version === 'squads-v4')
    : chain === 'solana';

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-3xl max-h-[92vh] flex flex-col p-6 sm:p-7 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-md shrink-0 ${
              chain === 'solana'
                ? 'bg-gradient-to-br from-[#9945FF]/30 to-[#14F195]/20 border-[#14F195]/30 text-[#14F195]'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-amber-500/10'
            }`}>
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Generate Master Vault Treasury</h2>
                <span className={chain === 'solana' ? 'badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30' : 'badge badge-gold'}>
                  {chain === 'solana' ? 'Solana Vault' : 'TON Vault'}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Create a dedicated master vault to store, fund, and distribute assets across all studio wallets
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 shrink-0">
            {error}
          </div>
        )}

        {!createdVault ? (
          <>
            {/* Configuration Setup View */}
            <div className="flex-1 overflow-y-auto pt-4 pb-8 space-y-5 pr-1.5">
            
            {/* Step 1: Blockchain Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                1. Select Blockchain:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectChain('ton')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                    chain === 'ton'
                      ? 'bg-[#0098EA]/15 border-[#0098EA] shadow-lg shadow-[#0098EA]/20 ring-1 ring-[#0098EA]'
                      : 'bg-[#0a0f1d] border-white/10 hover:border-white/20 text-gray-400'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0098EA]/20 border border-[#0098EA]/30 text-[#0098EA] flex items-center justify-center font-black text-base shrink-0 mt-0.5">
                    💎
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sm text-white">TON Blockchain</span>
                      <span className="badge badge-primary text-[10px]">The Open Network</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      v4R2, W5 Gasless, or v3R2 master vault for TON & Jettons (USDT, NOT, DOGS).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectChain('solana')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                    chain === 'solana'
                      ? 'bg-[#14F195]/15 border-[#14F195] shadow-lg shadow-[#14F195]/20 ring-1 ring-[#14F195]'
                      : 'bg-[#0a0f1d] border-white/10 hover:border-white/20 text-gray-400'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF]/30 to-[#14F195]/30 border border-[#14F195]/40 text-[#14F195] flex items-center justify-center font-black text-base shrink-0 mt-0.5">
                    🟣
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sm text-white">Solana Blockchain</span>
                      <span className="badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30 text-[10px]">SPL & Squads</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Standard Ed25519 keypair or Squads Protocol v4 multisig vault for SOL & SPL tokens.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Smart Contract Version Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                2. Choose Architecture & Version:
              </label>

              {chain === 'ton' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setVersion('v4R2')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                      version === 'v4R2'
                        ? 'bg-[#0098EA]/15 border-[#0098EA] shadow-md shadow-[#0098EA]/20 ring-1 ring-[#0098EA]'
                        : 'bg-[#0a0f1d] border-white/10 hover:border-white/20 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="font-bold text-sm text-white">v4R2</span>
                      <span className="badge badge-primary">Recommended</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Standard Tonkeeper contract. Compatible with all TON exchanges, DEXs and tools.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersion('W5')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                      version === 'W5'
                        ? 'bg-purple-500/15 border-purple-400 shadow-md shadow-purple-500/20 ring-1 ring-purple-400'
                        : 'bg-[#0a0f1d] border-white/10 hover:border-white/20 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="font-bold text-sm text-white">W5 (v5R1)</span>
                      <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30">Next-Gen</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Next-gen contract supporting gasless fees & up to 255 parallel batch transfers in 1 TX.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersion('v3R2')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                      version === 'v3R2'
                        ? 'bg-emerald-500/15 border-emerald-400 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                        : 'bg-[#0a0f1d] border-white/10 hover:border-white/20 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="font-bold text-sm text-white">v3R2</span>
                      <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Legacy</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Historical standard format for legacy infrastructure and contract compatibility.
                    </p>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVersion('solana-ed25519')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                      version === 'solana-ed25519'
                        ? 'bg-[#14F195]/15 border-[#14F195] shadow-md shadow-[#14F195]/20 ring-1 ring-[#14F195]'
                        : 'bg-[#0a0f1d] border-white/10 hover:border-white/20 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#14F195]" />
                        <span className="font-bold text-sm text-white">Ed25519 Native</span>
                      </div>
                      <span className="badge bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/30">Recommended</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Standard BIP44 (m/44'/501'/0'/0') keypair. Direct support for SOL & all SPL tokens (USDC, USDT, RAY, JUP).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersion('squads-v4')}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                      version === 'squads-v4'
                        ? 'bg-purple-500/15 border-purple-400 shadow-md shadow-purple-500/20 ring-1 ring-purple-400'
                        : 'bg-[#0a0f1d] border-white/10 hover:border-white/20 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-sm text-white">Squads Protocol v4</span>
                      </div>
                      <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30">Multisig Vault</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Institutional multisig vault PDA derived via Squads Protocol v4 program for enterprise treasury management.
                    </p>
                  </button>
                </div>
              )}
            </div>

            {/* Step 3: Custom Label & Tag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Vault Label / Name:</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Master Vault Treasury"
                  className="input-field py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Category Tag:</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Vault-Treasury"
                  className="input-field py-2 text-xs"
                />
              </div>
            </div>

            {/* Automatic Local Drive Backup Info Box */}
            <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 flex items-start gap-3.5 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Automatic Offline Backup</strong>
                <p className="text-gray-400 leading-relaxed">
                  Upon generation, a JSON backup file with your 24-word cryptographic seed phrase and address will be automatically saved directly to your local computer for offline safety.
                </p>
              </div>
            </div>

          </div>

          {/* Setup Action Footer */}
          <div className="pt-3 border-t border-white/10 shrink-0">
            <button
              type="button"
              onClick={handleGenerateVault}
              disabled={isGenerating}
              className={`w-full py-3.5 text-sm font-extrabold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                chain === 'solana'
                  ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black hover:opacity-95 shadow-[#14F195]/20 cursor-pointer'
                  : 'btn btn-gold text-white shadow-amber-500/30 cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <span>Deriving 24-Word Cryptographic Keypair...</span>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate {chain === 'solana' ? 'Solana' : 'TON'} Master Treasury ({getVersionDisplayName(version)}) & Save Copy</span>
                </>
              )}
            </button>
          </div>
        </>
        ) : (
        <>
          {/* Created Vault & Seed Phrase Confirmation View */}
          <div className="flex-1 overflow-y-auto pt-4 pb-8 space-y-4 pr-1.5">
            
            {/* Auto-Downloaded Success Alert */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isSolana ? 'Solana' : 'TON'} Master Treasury Created!
                  </h4>
                  <p className="text-xs text-emerald-300/80">
                    Backup JSON file automatically saved to your downloads folder.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadVaultBackupFile(createdVault)}
                className="btn btn-secondary btn-sm text-xs text-emerald-400 flex items-center gap-1"
                title="Download another copy"
              >
                <Download className="w-3.5 h-3.5" />
                {fileDownloaded ? 'Re-Download' : 'Download Copy'}
              </button>
            </div>

            {/* Vault Address Row */}
            <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-bold flex items-center gap-2">
                  <span>Master Treasury Address ({getVersionDisplayName(createdVault.version)}):</span>
                  <span className={isSolana ? 'badge bg-[#9945FF]/20 text-[#14F195]' : 'badge badge-primary'}>
                    {isSolana ? 'Solana' : 'TON'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="btn btn-secondary btn-sm py-1 px-2.5 text-xs text-gray-300 hover:text-white"
                >
                  {copiedAddr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAddr ? 'Copied' : 'Copy Address'}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-white font-bold break-all bg-[#121b30] p-3 rounded-xl border border-white/5 select-all">
                {createdVault.address}
              </p>
            </div>

            {/* Squads Vault PDA if present */}
            {createdVault.squadsVaultAddress && (
              <div className="bg-[#080d1a] p-4 rounded-2xl border border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300 font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Squads Protocol v4 Vault PDA Address:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyVaultPda}
                    className="btn btn-secondary btn-sm py-1 px-2.5 text-xs text-purple-300 hover:text-white"
                  >
                    {copiedVaultPda ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedVaultPda ? 'Copied' : 'Copy Vault PDA'}</span>
                  </button>
                </div>
                <p className="font-mono text-xs text-purple-200 font-bold break-all bg-[#121b30] p-3 rounded-xl border border-purple-500/20 select-all">
                  {createdVault.squadsVaultAddress}
                </p>
              </div>
            )}

            {/* 24-Word Seed Phrase Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Master 24-Word Secret Seed Phrase:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRevealed(!isRevealed)}
                    className="text-gray-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPhrase}
                    className="btn btn-secondary btn-sm py-1 px-2.5 text-xs text-amber-400"
                  >
                    {copiedPhrase ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPhrase ? 'Copied' : 'Copy Phrase'}</span>
                  </button>
                </div>
              </div>

              {isRevealed ? (
                <div className="bg-[#050811] p-4 rounded-2xl border border-amber-500/30">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {createdVault.mnemonic.map((word, idx) => (
                      <div 
                        key={idx}
                        className="bg-[#121b30] px-2.5 py-2 rounded-xl border border-white/5 flex items-center gap-2 text-xs"
                      >
                        <span className="font-mono text-[10px] text-gray-500 w-5 text-right shrink-0">{idx + 1}.</span>
                        <span className="font-mono font-bold text-amber-300 truncate">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#050811] p-6 rounded-2xl border border-white/5 text-center text-xs text-gray-500 font-mono">
                  •••••••••••••••••••••••• (24-word seed phrase hidden)
                </div>
              )}
            </div>

          </div>

          {/* Confirmation Action Footer */}
          <div className="pt-3 border-t border-white/10 shrink-0">
            <button
              type="button"
              onClick={handleFinishAndSave}
              className="w-full btn btn-primary py-3.5 text-sm font-bold shadow-lg shadow-[#0098EA]/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5" />
              <span>Set as Master Treasury & Open Studio</span>
            </button>
          </div>
        </>
        )}

      </div>
    </div>
  );
};
