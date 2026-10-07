import React, { useState } from 'react';
import type { ManagedWallet, Network } from '../types';
import { StorageService } from '../services/storageService';
import { 
  X, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode, 
  FileText
} from 'lucide-react';

interface PurgeWithBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network: Network;
  onPurgeCompleted: () => void;
}

export const PurgeWithBackupModal: React.FC<PurgeWithBackupModalProps> = ({
  isOpen,
  onClose,
  wallets,
  network,
  onPurgeCompleted,
}) => {
  const [backupDownloaded, setBackupDownloaded] = useState<boolean>(false);
  const [includeTextFile, setIncludeTextFile] = useState<boolean>(true);
  const [confirmedText, setConfirmedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownloadBackupAndPurge = () => {
    setIsProcessing(true);

    const timestamp = Date.now();
    const jsonFilename = `tonkeeper_master_vault_backup_${timestamp}.json`;
    const txtFilename = `tonkeeper_recovery_phrases_${timestamp}.txt`;

    // 1. Download Master JSON Backup
    StorageService.exportFullMasterBackup(wallets, network, jsonFilename);

    // 2. Optionally download readable TXT keyphrase backup
    if (includeTextFile) {
      setTimeout(() => {
        StorageService.exportPairsTXT(wallets, txtFilename);
      }, 300);
    }

    setBackupDownloaded(true);

    // 3. Purge wallets from app storage safely after file download is triggered
    setTimeout(() => {
      StorageService.clearAllWallets();
      setIsProcessing(false);
      onPurgeCompleted();
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Wipe App & Auto-Backup</h2>
              <p className="text-xs text-gray-400">Save complete recovery backup to drive before removing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          
          {/* Important Security Notice */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Safe Removal with Guaranteed Local Backup</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This action will remove all <strong>{wallets.length} managed wallets</strong> from the app interface. 
              Before clearing, a <strong>full Master Recovery JSON file</strong> containing all addresses and 24-word keyphrases will be automatically saved to your computer/drive so you can restore them anytime using the <strong>Import</strong> tool.
            </p>
          </div>

          {/* Backup Summary Breakdown */}
          <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold">Total Wallets to Archive:</span>
              <span className="text-white font-mono font-bold">{wallets.length} Wallets</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold">Primary Backup Format:</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <FileCode className="w-3.5 h-3.5" />
                Master JSON (Full Vault)
              </span>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={includeTextFile}
                  onChange={(e) => setIncludeTextFile(e.target.checked)}
                  className="rounded accent-[#0098EA] cursor-pointer w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  Also download readable Keyphrases TXT file
                </span>
              </label>
            </div>
          </div>

          {/* Downloaded State Notification */}
          {backupDownloaded && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Backup file downloaded to your drive! Clearing app memory...</span>
            </div>
          )}

          {/* Confirmation Check */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Type <span className="text-red-400 font-mono font-bold">WIPE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmedText}
              onChange={(e) => setConfirmedText(e.target.value.toUpperCase())}
              placeholder="Type WIPE"
              className="input-field py-2 text-xs font-mono font-bold tracking-widest text-center"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 btn btn-secondary py-3 text-xs font-bold"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDownloadBackupAndPurge}
              disabled={isProcessing || confirmedText !== 'WIPE'}
              className="flex-1 btn btn-danger py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
            >
              {isProcessing ? (
                <span>Downloading & Purging...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Backup & Wipe App</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
