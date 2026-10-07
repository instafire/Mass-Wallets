import React, { useState } from 'react';
import type { ManagedWallet, Network } from '../types';
import { isSolanaWallet } from '../types';
import { TonService } from '../services/tonService';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink, Download, Smartphone, ShieldCheck, Sparkles } from 'lucide-react';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: ManagedWallet | null;
  network?: Network;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
  isOpen,
  onClose,
  wallet,
  network = 'mainnet',
}) => {
  const [presetAmount, setPresetAmount] = useState<string>('');
  const [presetComment, setPresetComment] = useState<string>('');
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [useVaultPda, setUseVaultPda] = useState<boolean>(false);

  // Solana wallets default to 'plain' Base58 address for 100% compatibility with Pump.fun & mobile apps
  const [qrFormat, setQrFormat] = useState<'plain' | 'uri'>('plain');

  if (!isOpen || !wallet) return null;

  const isSolana = isSolanaWallet(wallet);
  const hasVault = !!wallet.squadsVaultAddress;
  const targetAddress = (isSolana && useVaultPda && wallet.squadsVaultAddress) 
    ? wallet.squadsVaultAddress 
    : wallet.address;

  // Determine QR code value
  let qrValue = targetAddress;
  let tonkeeperWebUrl = '';

  if (isSolana) {
    if (qrFormat === 'plain') {
      // Raw Base58 address: universally recognized by Pump.fun app, Phantom, Solflare, exchanges
      qrValue = targetAddress;
    } else {
      // Solana Pay URI standard: solana:<address>?amount=...&memo=...
      const params = new URLSearchParams();
      if (presetAmount && parseFloat(presetAmount) > 0) {
        params.append('amount', presetAmount);
      }
      if (presetComment.trim()) {
        params.append('memo', presetComment.trim());
      }
      const qs = params.toString();
      qrValue = `solana:${targetAddress}${qs ? `?${qs}` : ''}`;
    }
  } else {
    // TON wallet
    const tonData = TonService.getTonkeeperDeepLink(wallet.address, presetAmount, presetComment);
    tonkeeperWebUrl = tonData.webUrl;
    if (qrFormat === 'plain') {
      qrValue = wallet.address;
    } else {
      qrValue = tonData.webUrl;
    }
  }

  const explorerUrl = isSolana
    ? (network === 'mainnet'
        ? `https://solscan.io/account/${targetAddress}`
        : `https://solscan.io/account/${targetAddress}?cluster=devnet`)
    : (network === 'mainnet'
        ? `https://tonviewer.com/${targetAddress}`
        : `https://testnet.tonviewer.com/${targetAddress}`);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(targetAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopyLink = () => {
    const textToCopy = isSolana ? qrValue : tonkeeperWebUrl;
    navigator.clipboard.writeText(textToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('receive-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20, 260, 260);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        const prefix = isSolana ? (useVaultPda ? 'solana_vault' : 'solana') : 'ton';
        downloadLink.download = `${prefix}_qr_${wallet.label.replace(/\s+/g, '_')}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md p-6 relative text-center">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 text-left">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                Receive {isSolana ? 'Solana & Tokens' : 'TON'}
              </h2>
              {isSolana && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/30">
                  Pump.fun Ready
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {isSolana 
                ? 'Scan with Pump.fun app, Phantom, Solflare, or camera'
                : 'Scan or share address / Tonkeeper link'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          
          {/* Label Badge & Chain Indicator */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 bg-[#121b30] px-3 py-1 rounded-full border border-white/10 text-xs">
              <span className="font-bold text-white">{wallet.label}</span>
              <span className={isSolana ? 'badge bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30' : 'badge badge-primary'}>
                {wallet.version === 'solana-ed25519' ? 'Ed25519' : wallet.version === 'squads-v4' ? 'Squads v4' : wallet.version}
              </span>
            </div>

            {hasVault && isSolana && (
              <button
                type="button"
                onClick={() => setUseVaultPda(!useVaultPda)}
                className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1 transition-all ${
                  useVaultPda 
                    ? 'bg-[#14F195]/20 text-[#14F195] border-[#14F195]/40 shadow-sm'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{useVaultPda ? 'Using Squads Vault PDA' : 'Switch to Squads Vault'}</span>
              </button>
            )}
          </div>

          {/* Format Selector Pills */}
          <div className="flex items-center justify-center gap-1.5 p-1 bg-[#080d1a] rounded-xl border border-white/10 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => setQrFormat('plain')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                qrFormat === 'plain'
                  ? isSolana 
                    ? 'bg-[#14F195] text-black font-bold shadow-md' 
                    : 'bg-[#0098EA] text-white font-bold shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Plain Address
            </button>
            <button
              type="button"
              onClick={() => setQrFormat('uri')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                qrFormat === 'uri'
                  ? isSolana 
                    ? 'bg-[#14F195] text-black font-bold shadow-md' 
                    : 'bg-[#0098EA] text-white font-bold shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {isSolana ? 'Solana Pay' : 'Tonkeeper'}
            </button>
          </div>

          {/* Dynamic Scannable QR Code Card */}
          <div className="relative inline-block">
            <div className={`p-4 bg-white rounded-2xl inline-block shadow-2xl relative border-4 transition-all ${
              isSolana ? 'border-[#14F195]/40 shadow-[#14F195]/10' : 'border-[#0098EA]/40 shadow-[#0098EA]/10'
            }`}>
              <QRCodeSVG
                id="receive-qr-code"
                value={qrValue}
                size={210}
                level="M"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>

            {/* Pump.fun Compatibility pill */}
            {isSolana && qrFormat === 'plain' && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#14F195] bg-[#14F195]/10 py-1 px-3 rounded-full border border-[#14F195]/20 font-medium">
                <Sparkles className="w-3 h-3 text-[#14F195]" />
                <span>Pump.fun App Scanner Verified (Plain Base58)</span>
              </div>
            )}
          </div>

          {/* Address Display & Copy */}
          <div className="bg-[#080d1a] p-3 rounded-xl border border-white/10 text-left space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold">
                {isSolana 
                  ? (useVaultPda ? 'Squads v4 Vault PDA:' : 'Solana Address (Base58):')
                  : 'TON Address:'}
              </span>
              <button
                onClick={handleCopyAddress}
                className={`hover:underline flex items-center gap-1 font-bold text-xs ${
                  isSolana ? 'text-[#14F195]' : 'text-[#0098EA]'
                }`}
              >
                {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAddress ? 'Copied!' : 'Copy Address'}
              </button>
            </div>
            <p className="font-mono text-xs text-white break-all bg-[#121b30] p-2.5 rounded-lg select-all border border-white/5">
              {targetAddress}
            </p>
          </div>

          {/* Optional Amount Preset */}
          {qrFormat === 'uri' && (
            <div className="grid grid-cols-2 gap-3 text-left animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Amount ({isSolana ? 'SOL' : 'TON'}):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={presetAmount}
                  onChange={(e) => setPresetAmount(e.target.value)}
                  placeholder="e.g. 1.5"
                  className="input-field py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Memo / Note:
                </label>
                <input
                  type="text"
                  value={presetComment}
                  onChange={(e) => setPresetComment(e.target.value)}
                  placeholder="e.g. Pump token swap"
                  className="input-field py-1.5 text-xs"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary py-2 text-xs flex items-center justify-center gap-1.5 text-gray-300 hover:text-white"
              >
                <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                <span>{isSolana ? 'View on Solscan' : 'View on Tonviewer'}</span>
              </a>

              <button
                onClick={handleDownloadQR}
                className="btn btn-secondary py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QR</span>
              </button>
            </div>

            {qrFormat === 'uri' && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn btn-secondary py-2 text-xs flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#14F195]" />}
                <span>{copiedLink ? 'Link Copied!' : (isSolana ? 'Copy Solana Pay URI' : 'Copy Tonkeeper Link')}</span>
              </button>
            )}

            {!isSolana && tonkeeperWebUrl && (
              <a
                href={tonkeeperWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full btn btn-primary py-2.5 text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#0098EA]/30"
              >
                <Smartphone className="w-4 h-4" />
                Open in Tonkeeper Wallet
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {isSolana && (
              <button
                onClick={handleCopyAddress}
                className="w-full btn py-2.5 text-xs flex items-center justify-center gap-2 font-bold bg-[#14F195] text-black hover:bg-[#10c87b] transition-all shadow-lg shadow-[#14F195]/20"
              >
                {copiedAddress ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
                {copiedAddress ? 'Address Copied to Clipboard!' : 'Copy Solana Address for Pump.fun'}
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
