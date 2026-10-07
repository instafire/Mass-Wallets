import React from 'react';
import type { ManagedWallet, VaultConfig } from '../types';
import { TonService } from '../services/tonService';
import { X, AlertTriangle, Lock, CheckCircle2, Award } from 'lucide-react';

interface HealthAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  vaultConfig: VaultConfig;
  onOpenSecurity: () => void;
  onOpenRecovery: () => void;
}

export const HealthAuditModal: React.FC<HealthAuditModalProps> = ({
  isOpen,
  onClose,
  wallets,
  vaultConfig,
  onOpenSecurity,
  onOpenRecovery,
}) => {
  if (!isOpen) return null;

  const audit = TonService.auditWalletHealth(wallets, vaultConfig.hasPin);

  const getScoreBadgeClass = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 70) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (score >= 50) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Wallet Security & Health Audit</h2>
              <p className="text-xs text-gray-400">Automated vault security analysis & backup status</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-5">
          
          {/* Health Score Banner */}
          <div className="bg-[#080d1a] p-5 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Security Health Rating</span>
              <div className="flex items-center gap-3 mt-1">
                <h3 className="text-3xl font-extrabold text-white">{audit.score} <span className="text-sm text-gray-500">/ 100</span></h3>
                <span className={`badge border text-xs font-bold px-3 py-1 ${getScoreBadgeClass(audit.score)}`}>
                  {audit.level}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Inspected {wallets.length} wallet(s) in studio</p>
            </div>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0098EA]/20 to-purple-500/20 flex items-center justify-center text-[#0098EA] font-extrabold text-xl border border-[#0098EA]/30">
              {audit.score}%
            </div>
          </div>

          {/* Audit Checks Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Security Audit Checkpoints:</h4>

            {/* Checkpoint 1: Vault PIN Encryption */}
            <div className="bg-[#121b30] p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {vaultConfig.hasPin ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-white text-xs">AES-256 Storage PIN Protection</p>
                  <p className="text-[11px] text-gray-400">
                    {vaultConfig.hasPin ? 'Master PIN protection active' : 'Vault storage currently unencrypted'}
                  </p>
                </div>
              </div>
              {!vaultConfig.hasPin && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSecurity();
                  }}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Enable PIN
                </button>
              )}
            </div>

            {/* Checkpoint 2: Seed Phrase Recovery Backup */}
            <div className="bg-[#121b30] p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-white text-xs">24-Word Keyphrases Auto-Saved</p>
                  <p className="text-[11px] text-gray-400">All {wallets.length} wallet keyphrases backed up locally</p>
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenRecovery();
                }}
                className="btn btn-secondary btn-sm text-xs text-amber-400"
              >
                View Phrases
              </button>
            </div>

          </div>

          {/* Recommendations */}
          {audit.recommendations.length > 0 && (
            <div className="bg-[#080d1a] p-4 rounded-xl border border-white/10 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Action Recommendations:</h4>
              <ul className="space-y-1 text-xs text-gray-300 list-disc list-inside">
                {audit.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
