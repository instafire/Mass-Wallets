import React, { useState } from 'react';
import type { ManagedWallet } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, QrCode, Check, Copy, Sparkles } from 'lucide-react';

interface QRSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
}

export const QRSheetModal: React.FC<QRSheetModalProps> = ({
  isOpen,
  onClose,
  wallets,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrFormat, setQrFormat] = useState<'plain' | 'deeplink'>('plain');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyAddress = (id: string, addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-5xl p-6 relative">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14F195]/20 text-[#14F195] flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Printable Wallet QR Sheet</h2>
                <span className="badge bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/30 text-xs">
                  {wallets.length} Wallets
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Optimized for Pump.fun app scanner, mobile cameras, and cold storage printouts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Format Selector */}
            <div className="flex items-center gap-1 bg-[#080d1a] p-1 rounded-lg border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setQrFormat('plain')}
                className={`py-1.5 px-2.5 rounded font-medium transition-all ${
                  qrFormat === 'plain'
                    ? 'bg-[#14F195] text-black font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Recommended: Raw Base58 / TON address scannable by Pump.fun and all mobile apps"
              >
                Plain Address (Pump.fun)
              </button>
              <button
                type="button"
                onClick={() => setQrFormat('deeplink')}
                className={`py-1.5 px-2.5 rounded font-medium transition-all ${
                  qrFormat === 'deeplink'
                    ? 'bg-[#0098EA] text-white font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Deep Links: solana:... or tonkeeper:..."
              >
                Deep Links
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Print QR Sheet
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informative Tip */}
        <div className="mt-3 p-2.5 bg-[#14F195]/10 border border-[#14F195]/20 rounded-xl text-xs text-[#14F195] flex items-center gap-2 print:hidden">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>
            <strong>Pump.fun & Mobile Scanner Ready:</strong> All QR codes use high-contrast formatting with built-in quiet zone margins and Base58 string encoding for instantaneous mobile camera recognition.
          </span>
        </div>

        {/* Printable Grid Sheet */}
        <div className="py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[72vh] overflow-y-auto print:max-h-none print:grid-cols-3">
          {wallets.map((wallet, idx) => {
            const isSolana = wallet.chain === 'solana' || wallet.version === 'solana-ed25519' || wallet.version === 'squads-v4';
            
            // Value for QR Code:
            let qrValue = wallet.address;
            if (qrFormat === 'deeplink') {
              qrValue = isSolana ? `solana:${wallet.address}` : `https://app.tonkeeper.com/transfer/${wallet.address}`;
            }

            return (
              <div 
                key={wallet.id}
                className="bg-[#080d1a] border border-white/10 p-4 rounded-xl text-center space-y-3 print:bg-white print:text-black print:border-black print:shadow-none"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 truncate text-left">
                    <span className="font-bold text-white print:text-black truncate">
                      #{idx + 1} {wallet.label}
                    </span>
                  </div>
                  <span className={`badge ${
                    isSolana 
                      ? 'bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30' 
                      : 'badge-primary'
                  } print:border-black print:text-black`}>
                    {isSolana ? (wallet.version === 'squads-v4' ? 'Squads v4' : 'Solana') : wallet.version}
                  </span>
                </div>

                {/* QR Code Container with White Margin & High Contrast */}
                <div className={`p-3 bg-white rounded-xl inline-block border-2 ${
                  isSolana ? 'border-[#14F195]/40' : 'border-[#0098EA]/40'
                } print:border-black shadow-md`}>
                  <QRCodeSVG
                    value={qrValue}
                    size={140}
                    level="M"
                    includeMargin={true}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                  />
                </div>

                {/* Address & Copy */}
                <div className="space-y-1">
                  <p className="font-mono text-[10px] text-gray-300 print:text-black break-all bg-[#121b30] p-1.5 rounded-lg print:bg-gray-100 select-all border border-white/5">
                    {wallet.address}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyAddress(wallet.id, wallet.address)}
                    className={`text-[11px] hover:underline flex items-center justify-center gap-1 mx-auto print:hidden font-semibold transition-all ${
                      isSolana ? 'text-[#14F195]' : 'text-[#0098EA]'
                    }`}
                  >
                    {copiedId === wallet.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === wallet.id ? 'Copied Address' : 'Copy Address'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
