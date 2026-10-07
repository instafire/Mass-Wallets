import React, { useState } from 'react';
import type { ManagedWallet, WalletVersion } from '../types';
import { TonService } from '../services/tonService';
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
  EyeOff
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
  const [version, setVersion] = useState<WalletVersion>('v4R2');
  const [label, setLabel] = useState<string>('Master Vault Treasury');
  const [tag, setTag] = useState<string>('Vault-Treasury');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [createdVault, setCreatedVault] = useState<ManagedWallet | null>(null);
  
  const [isRevealed, setIsRevealed] = useState<boolean>(true);
  const [copiedPhrase, setCopiedPhrase] = useState<boolean>(false);
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);
  const [fileDownloaded, setFileDownloaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateVault = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const wallet = await TonService.createWallet(
        version,
        label || 'Master Vault Treasury',
        tag || 'Vault',
        698983191
      );

      wallet.isMainWallet = true;
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
    const backupData = {
      type: 'TON_MASTER_VAULT_BACKUP',
      version: wallet.version,
      label: wallet.label,
      tag: wallet.tag,
      address: wallet.address,
      rawAddress: wallet.rawAddress,
      publicKey: wallet.publicKey,
      mnemonic: wallet.mnemonic.join(' '),
      mnemonicWords: wallet.mnemonic,
      createdAt: new Date(wallet.createdAt).toISOString(),
      isMainWallet: true,
      note: 'Master Vault Treasury Wallet Backup - Keep this 24-word phrase safe and secret.',
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master_vault_${wallet.version}_${wallet.address.substring(0, 8)}_${Date.now()}.json`;
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

  const handleFinishAndSave = () => {
    if (!createdVault) return;
    onVaultCreated(createdVault);
    setCreatedVault(null);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-md shadow-amber-500/10">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Generate Master Vault Wallet</h2>
                <span className="badge badge-gold">Primary Vault</span>
              </div>
              <p className="text-xs text-gray-400">
                Create a dedicated vault wallet to fund and distribute TON & tokens to all other wallets
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {!createdVault ? (
          /* Configuration Setup View */
          <div className="py-5 space-y-5">
            
            {/* Step 1: Wallet Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Choose Smart Contract Version for Master Vault:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setVersion('v4R2')}
                  className={`tab-btn p-3.5 text-left transition-all ${version === 'v4R2' ? 'active-primary' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">v4R2</span>
                    <span className="badge badge-primary">Recommended</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Standard Tonkeeper contract. Compatible with all TON exchanges & tools.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVersion('W5')}
                  className={`tab-btn p-3.5 text-left transition-all ${version === 'W5' ? 'active-purple' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">W5</span>
                    <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30">Next-Gen</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Next-gen contract with gasless fees & up to 255 parallel transfers in 1 batch.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVersion('v3R2')}
                  className={`tab-btn p-3.5 text-left transition-all ${version === 'v3R2' ? 'active-emerald' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">v3R2</span>
                    <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Legacy</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Historical standard format for legacy infrastructure compatibility.
                  </p>
                </button>
              </div>
            </div>

            {/* Custom Label & Tag */}
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
            <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 flex items-start gap-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Automatic Local Drive Backup</strong>
                <p className="text-gray-400 leading-relaxed">
                  When you click generate, a standalone JSON recovery file containing your master vault seed phrase and address will be automatically downloaded directly to your local drive for safe offline keeping.
                </p>
              </div>
            </div>

            {/* Generate Trigger Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerateVault}
                disabled={isGenerating}
                className="w-full btn btn-gold py-3.5 text-base font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30"
              >
                {isGenerating ? (
                  <span>Deriving 24-Word Master Vault...</span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Master Vault ({version}) & Save Copy to Drive</span>
                  </>
                )}
              </button>
            </div>

          </div>
        ) : (
          /* Created Vault & Seed Phrase Confirmation View */
          <div className="py-5 space-y-4">
            
            {/* Auto-Downloaded Success Alert */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">Master Vault Wallet Created!</h4>
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
            <div className="bg-[#080d1a] p-3.5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-semibold">Master Vault Address ({createdVault.version}):</span>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="btn btn-secondary btn-sm py-1 px-2.5 text-xs text-gray-300 hover:text-white"
                >
                  {copiedAddr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAddr ? 'Copied' : 'Copy Address'}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-white font-bold break-all bg-[#121b30] p-2.5 rounded-xl border border-white/5">
                {createdVault.address}
              </p>
            </div>

            {/* 24-Word Seed Phrase Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Master 24-Word Seed Phrase:
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
                <div className="bg-[#050811] p-3.5 rounded-2xl border border-amber-500/30">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                    {createdVault.mnemonic.map((word, idx) => (
                      <div 
                        key={idx}
                        className="bg-[#121b30] px-2 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5 text-xs"
                      >
                        <span className="font-mono text-[10px] text-gray-500 w-4 text-right">{idx + 1}.</span>
                        <span className="font-mono font-bold text-amber-300 truncate">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#050811] p-4 rounded-2xl border border-white/5 text-center text-xs text-gray-500 font-mono">
                  •••••••••••••••••••••••• (24-word seed phrase hidden)
                </div>
              )}
            </div>

            {/* Confirmation & Finish Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleFinishAndSave}
                className="w-full btn btn-primary py-3.5 text-base font-bold shadow-lg shadow-[#0098EA]/30 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>Set as Master Treasury & Open Studio</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
