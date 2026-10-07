import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink, QrCode, Sparkles } from 'lucide-react';
import type { ManagedWallet, Network } from '../types';

interface QuickQRPopoverProps {
  wallet: ManagedWallet | null;
  network: Network;
  onClose: () => void;
}

export const QuickQRPopover: React.FC<QuickQRPopoverProps> = ({ wallet, network, onClose }) => {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrFormat, setQrFormat] = useState<'plain' | 'uri'>('plain');

  if (!wallet) return null;

  const isSolana = wallet.chain === 'solana' || wallet.version === 'solana-ed25519' || wallet.version === 'squads-v4';

  // For Solana: Raw Base58 address is strictly required by Pump.fun app scanner
  // For TON: plain or deep link
  const qrValue = isSolana
    ? (qrFormat === 'plain' ? wallet.address : `solana:${wallet.address}`)
    : (qrFormat === 'plain' ? wallet.address : `ton://transfer/${wallet.address}`);

  const explorerUrl = isSolana
    ? (network === 'mainnet'
        ? `https://solscan.io/account/${wallet.address}`
        : `https://solscan.io/account/${wallet.address}?cluster=devnet`)
    : (network === 'mainnet'
        ? `https://tonviewer.com/${wallet.address}`
        : `https://testnet.tonviewer.com/${wallet.address}`);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleCopyLink = () => {
    const text = isSolana 
      ? (qrFormat === 'plain' ? wallet.address : `solana:${wallet.address}`)
      : `ton://transfer/${wallet.address}`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="glass-card max-w-sm w-full p-6 border border-white/20 shadow-2xl relative space-y-4 text-center">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 text-left">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isSolana ? 'bg-[#14F195]/20 text-[#14F195]' : 'bg-[#0098EA]/20 text-[#0098EA]'
            }`}>
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{wallet.label}</h3>
              <p className="text-[11px] text-gray-400 font-mono">
                {isSolana ? (wallet.version === 'squads-v4' ? 'Squads v4' : 'Solana Ed25519') : `${wallet.version} • ${wallet.tag}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pump.fun notice for Solana */}
        {isSolana && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#14F195] bg-[#14F195]/10 py-1 px-2.5 rounded-lg border border-[#14F195]/20 font-semibold">
            <Sparkles className="w-3 h-3 text-[#14F195]" />
            <span>Pump.fun Mobile Scanner Compatible</span>
          </div>
        )}

        {/* Format Selector */}
        <div className="flex items-center justify-center gap-1 bg-[#080d1a] p-1 rounded-lg border border-white/10 max-w-[240px] mx-auto text-xs">
          <button
            type="button"
            onClick={() => setQrFormat('plain')}
            className={`flex-1 py-1 px-2 rounded font-medium transition-all ${
              qrFormat === 'plain'
                ? isSolana ? 'bg-[#14F195] text-black font-bold' : 'bg-[#0098EA] text-white font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Raw Base58
          </button>
          <button
            type="button"
            onClick={() => setQrFormat('uri')}
            className={`flex-1 py-1 px-2 rounded font-medium transition-all ${
              qrFormat === 'uri'
                ? isSolana ? 'bg-[#14F195] text-black font-bold' : 'bg-[#0098EA] text-white font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {isSolana ? 'Solana Pay' : 'Deep Link'}
          </button>
        </div>

        {/* QR Code Container with High Contrast & Quiet Zone Margin */}
        <div className={`p-4 bg-white rounded-2xl shadow-xl inline-block mx-auto border-2 ${
          isSolana ? 'border-[#14F195]/30' : 'border-[#0098EA]/30'
        }`}>
          <QRCodeSVG
            value={qrValue}
            size={180}
            level="M"
            includeMargin={true}
            bgColor="#FFFFFF"
            fgColor="#000000"
          />
        </div>

        {/* Address & Copy */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold text-gray-400 block">
            {isSolana ? 'Solana Address (Base58):' : 'TON Address:'}
          </label>
          <div className="bg-[#080d1a] p-2.5 rounded-xl border border-white/10 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-gray-200 truncate select-all">
              {wallet.address}
            </span>
            <button
              onClick={handleCopyAddress}
              className={`p-1.5 rounded-lg hover:text-white bg-white/5 hover:bg-white/10 transition-all shrink-0 ${
                isSolana ? 'text-[#14F195]' : 'text-gray-400'
              }`}
              title="Copy Address"
            >
              {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleCopyLink}
            className="btn btn-secondary btn-sm py-2 text-xs flex items-center justify-center gap-1.5"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#14F195]" />}
            <span>{copiedLink ? 'Copied!' : (isSolana ? 'Copy Address' : 'Copy Link')}</span>
          </button>

          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm py-2 text-xs flex items-center justify-center gap-1.5 text-gray-300 hover:text-white"
          >
            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
            <span>{isSolana ? 'Solscan' : 'Tonviewer'}</span>
          </a>
        </div>

      </div>
    </div>
  );
};
