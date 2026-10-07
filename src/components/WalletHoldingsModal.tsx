import React, { useState, useMemo } from 'react';
import type { ManagedWallet, NFTItem, Network } from '../types';
import { isSolanaWallet } from '../types';
import { PriceService, type PriceData } from '../services/priceService';
import { SUPPORTED_SOLANA_TOKENS } from '../services/solanaService';
import { 
  X, 
  Crown, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Send, 
  ArrowDownLeft, 
  Key, 
  History, 
  Edit3, 
  ShieldCheck, 
  Coins, 
  Image as ImageIcon, 
  Search,
  Tag
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface WalletHoldingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: ManagedWallet | null;
  network?: Network;
  onOpenSend: (wallet: ManagedWallet, preselectedToken?: string) => void;
  onOpenReceive: (wallet: ManagedWallet) => void;
  onOpenKeys: (wallet: ManagedWallet) => void;
  onOpenHistory: (wallet: ManagedWallet) => void;
  onOpenEdit?: (wallet: ManagedWallet) => void;
  onOpenSendNFT?: (nft: NFTItem, ownerWallet: ManagedWallet) => void;
  onSetAsTreasury?: (walletId: string) => void;
}

export const WalletHoldingsModal: React.FC<WalletHoldingsModalProps> = ({
  isOpen,
  onClose,
  wallet,
  network = 'mainnet',
  onOpenSend,
  onOpenReceive,
  onOpenKeys,
  onOpenHistory,
  onOpenEdit,
  onOpenSendNFT,
  onSetAsTreasury,
}) => {
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);
  const [copiedTokenKey, setCopiedTokenKey] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<boolean>(false);
  const [tokenSearch, setTokenSearch] = useState<string>('');
  const [priceData] = useState<PriceData>(PriceService.getPrices());

  const isSolana = wallet ? isSolanaWallet(wallet) : false;
  const nativeSymbol = isSolana ? 'SOL' : 'TON';
  const nativeBalNum = parseFloat(wallet?.balance || '0');
  const nativePrice = isSolana ? (priceData.solUsd || 154.20) : (priceData.tonUsd || 5.42);
  const nativeUsdVal = nativeBalNum * nativePrice;

  // Filter ONLY tokens where wallet holds balance > 0
  const heldTokens = useMemo(() => {
    if (!wallet) return [];
    return (wallet.jettons || []).filter(j => {
      const balNum = parseFloat(j.balance || '0');
      return balNum > 0 && j.symbol !== 'TON' && j.symbol !== 'SOL';
    });
  }, [wallet]);

  // Filtered tokens based on search
  const filteredTokens = useMemo(() => {
    if (!tokenSearch.trim()) return heldTokens;
    const q = tokenSearch.toLowerCase().trim();
    return heldTokens.filter(t => 
      t.symbol.toLowerCase().includes(q) ||
      (t.name || '').toLowerCase().includes(q) ||
      (t.jettonAddress || '').toLowerCase().includes(q)
    );
  }, [heldTokens, tokenSearch]);

  // Calculate total USD value of held tokens
  const totalTokensUsd = useMemo(() => {
    return heldTokens.reduce((sum, t) => {
      const bal = parseFloat(t.balance || '0');
      const tokenPrice = isSolana
        ? (SUPPORTED_SOLANA_TOKENS.find(s => s.symbol.toUpperCase() === t.symbol.toUpperCase())?.usdPrice || priceData.tokens[t.symbol.toUpperCase()] || 0)
        : (priceData.tokens[t.symbol.toUpperCase()] || 0);
      return sum + (bal * tokenPrice);
    }, 0);
  }, [heldTokens, isSolana, priceData]);

  const totalPortfolioUsd = nativeUsdVal + totalTokensUsd;

  if (!isOpen || !wallet) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleCopyTokenMint = (mint: string) => {
    navigator.clipboard.writeText(mint);
    setCopiedTokenKey(mint);
    setTimeout(() => setCopiedTokenKey(null), 2000);
  };

  const getExplorerUrl = (address: string) => {
    if (isSolana) {
      const cluster = network === 'testnet' ? '?cluster=devnet' : '';
      return `https://solscan.io/account/${address}${cluster}`;
    }
    const domain = network === 'mainnet' ? 'tonviewer.com' : 'testnet.tonviewer.com';
    return `https://${domain}/${address}`;
  };

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-3xl p-6 relative max-h-[92vh] flex flex-col">
        
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold shadow-lg shrink-0 border ${
              wallet.isMainWallet 
                ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-black border-amber-500/40 shadow-amber-500/20' 
                : isSolana 
                  ? 'bg-[#9945FF]/20 text-[#14F195] border-[#14F195]/30 shadow-[#9945FF]/20' 
                  : 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/30 shadow-[#0098EA]/20'
            }`}>
              {wallet.isMainWallet ? <Crown className="w-6 h-6 text-[#070a14]" /> : <Coins className="w-6 h-6" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isSolana 
                    ? 'bg-[#9945FF]/20 text-[#14F195] border-[#14F195]/30' 
                    : 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30'
                }`}>
                  {isSolana ? '🟣 Solana' : '💎 TON Blockchain'}
                </span>

                <h2 className="text-lg font-black text-white tracking-tight truncate">{wallet.label}</h2>

                {wallet.isMainWallet && (
                  <span className="badge badge-gold font-bold flex items-center gap-1 text-[10px]">
                    <Crown className="w-3 h-3" /> Master Treasury
                  </span>
                )}

                <span className="badge badge-primary text-[10px]">{wallet.version}</span>

                {onOpenEdit && (
                  <button
                    onClick={() => { onClose(); onOpenEdit(wallet); }}
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    title="Edit Label & Tag"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {wallet.tag && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Tag className="w-3 h-3 text-[#0098EA]" />
                  <span>{wallet.tag}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!wallet.isMainWallet && onSetAsTreasury && (
              <button
                onClick={() => { onSetAsTreasury(wallet.id); }}
                className="btn btn-gold btn-sm text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                title="Designate this wallet as the central Master Treasury"
              >
                <Crown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Set as Treasury</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Address & Squads Info Bar */}
        <div className="py-3 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-[#070b14] px-4 rounded-xl border border-white/5 mt-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-mono text-gray-300 select-all truncate">
              {wallet.address}
            </span>
            <button
              onClick={() => handleCopy(wallet.address)}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0 flex items-center gap-1 text-xs font-semibold"
              title="Copy Address"
            >
              {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAddr ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setShowQR(!showQR)}
              className={`p-1 rounded transition-all shrink-0 ${showQR ? 'bg-[#0098EA] text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title="Toggle QR Code"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          </div>

          <a
            href={getExplorerUrl(wallet.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#0098EA] hover:text-[#38bdf8] flex items-center gap-1 font-semibold shrink-0"
          >
            <span>{isSolana ? 'Solscan' : 'Tonviewer'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Optional QR Code expansion */}
        {showQR && (
          <div className="p-4 bg-[#0a1020] rounded-xl border border-white/10 flex flex-col items-center justify-center my-3 shrink-0 animate-in fade-in duration-200">
            <div className="p-3 bg-white rounded-xl shadow-xl">
              <QRCodeSVG value={wallet.address} size={150} level="M" />
            </div>
            <p className="text-[11px] text-gray-400 mt-2 font-mono text-center break-all max-w-md">
              {wallet.address}
            </p>
          </div>
        )}

        {/* Squads Multisig PDA Info (if available) */}
        {wallet.squadsVaultAddress && (
          <div className="p-3 bg-[#0f172a] rounded-xl border border-[#9945FF]/30 flex items-center justify-between text-xs my-2 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <ShieldCheck className="w-4 h-4 text-[#14F195] shrink-0" />
              <span className="text-[#14F195] font-bold">Squads Protocol v4 Vault PDA:</span>
              <span className="font-mono text-gray-300 truncate select-all">{wallet.squadsVaultAddress}</span>
            </div>
            <a
              href={`https://solscan.io/account/${wallet.squadsVaultAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#14F195] hover:underline flex items-center gap-1 shrink-0 ml-2"
            >
              <span>Verify PDA</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Scrollable Holdings Content Area */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 min-h-[300px]">
          
          {/* Portfolio Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Balance Card */}
            <div className="bg-[#0c1222] p-4 rounded-2xl border border-white/10 relative overflow-hidden">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Total Wallet Value
              </span>
              <div className="text-2xl font-black text-white font-mono mt-1">
                ${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold block mt-0.5">
                Native + {heldTokens.length} Secondary Tokens
              </span>
            </div>

            {/* Native Balance Card */}
            <div className="bg-[#0c1222] p-4 rounded-2xl border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  {nativeSymbol} Balance
                </span>
                <span className="text-base">{isSolana ? '🟣' : '💎'}</span>
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {wallet.balance} <span className="text-xs text-gray-400 font-bold">{nativeSymbol}</span>
              </div>
              <span className="text-[11px] text-gray-400 font-mono block mt-0.5">
                ≈ ${nativeUsdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Tokens / NFT Counts Card */}
            <div className="bg-[#0c1222] p-4 rounded-2xl border border-white/10 relative overflow-hidden">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Asset Types Held
              </span>
              <div className="text-2xl font-black text-amber-300 font-mono mt-1">
                {heldTokens.length} Tokens • {wallet.nfts?.length || 0} NFTs
              </div>
              <span className="text-[11px] text-gray-400 font-mono block mt-0.5">
                {heldTokens.length > 0 ? `$${totalTokensUsd.toFixed(2)} in tokens` : 'No secondary tokens'}
              </span>
            </div>
          </div>

          {/* SECTION: Held Tokens Breakdown */}
          <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Held Secondary Tokens ({heldTokens.length})
                </h3>
              </div>

              {heldTokens.length > 3 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Filter tokens..."
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className="input-field pl-8 py-1 text-xs w-44"
                  />
                </div>
              )}
            </div>

            {heldTokens.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs flex flex-col items-center justify-center space-y-2">
                <Coins className="w-8 h-8 opacity-30 text-gray-400" />
                <p className="font-semibold text-gray-400">No secondary tokens held in this wallet.</p>
                <p className="text-[11px] text-gray-500 max-w-sm">
                  Only tokens with an active, positive balance appear here. Deposit tokens to view them.
                </p>
                <button
                  onClick={() => { onClose(); onOpenReceive(wallet); }}
                  className="btn btn-secondary btn-sm text-xs font-bold mt-1"
                >
                  <ArrowDownLeft className="w-3 h-3 text-emerald-400 mr-1" />
                  Deposit Tokens
                </button>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="py-4 text-center text-gray-500 text-xs">
                No tokens match your search query "{tokenSearch}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredTokens.map(t => {
                  const balNum = parseFloat(t.balance || '0');
                  const tokenPrice = isSolana
                    ? (SUPPORTED_SOLANA_TOKENS.find(s => s.symbol.toUpperCase() === t.symbol.toUpperCase())?.usdPrice || priceData.tokens[t.symbol.toUpperCase()] || 0)
                    : (priceData.tokens[t.symbol.toUpperCase()] || 0);
                  const tokenUsdVal = balNum * tokenPrice;
                  const isPumpFun = t.jettonAddress?.endsWith('pump');

                  return (
                    <div 
                      key={t.symbol}
                      className="bg-[#10172a] p-3 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-[#0a0f1d] border border-white/10 flex items-center justify-center text-lg shrink-0">
                          {t.icon || '🪙'}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-xs">{t.symbol}</span>
                            {isPumpFun && (
                              <span className="text-[9px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                pump.fun
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500 truncate max-w-[100px]">{t.name}</span>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
                            <span className="text-amber-300 font-bold">{t.balance}</span>
                            {tokenUsdVal > 0 && (
                              <span className="text-[10px] text-gray-400">
                                (≈ ${tokenUsdVal.toFixed(2)})
                              </span>
                            )}
                          </div>

                          {t.jettonAddress && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500 font-mono">
                              <span className="truncate max-w-[120px]">
                                {t.jettonAddress.substring(0, 6)}...{t.jettonAddress.substring(t.jettonAddress.length - 4)}
                              </span>
                              <button
                                onClick={() => handleCopyTokenMint(t.jettonAddress)}
                                className="text-gray-400 hover:text-white p-0.5"
                                title="Copy Mint / Contract Address"
                              >
                                {copiedTokenKey === t.jettonAddress ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          onClick={() => {
                            onClose();
                            onOpenSend(wallet, t.symbol);
                          }}
                          className="btn btn-secondary btn-sm p-1.5 text-xs text-amber-300 hover:text-white"
                          title={`Send ${t.symbol}`}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION: Owned NFTs */}
          {wallet.nfts && wallet.nfts.length > 0 && (
            <div className="bg-[#080d1a] p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Owned NFT Collectibles ({wallet.nfts.length})
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {wallet.nfts.map(nft => (
                  <div 
                    key={nft.id}
                    className="glass-card p-2.5 rounded-xl border border-white/10 flex flex-col justify-between group hover:border-purple-500/40 transition-all"
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-black/40 mb-2 border border-white/5 flex items-center justify-center">
                      <img 
                        src={nft.image} 
                        alt={nft.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60';
                        }}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-purple-400 font-semibold truncate block">
                        {nft.collectionName || 'Collectible'}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{nft.name}</h4>
                    </div>
                    {onOpenSendNFT && (
                      <button
                        onClick={() => { onClose(); onOpenSendNFT(nft, wallet); }}
                        className="btn btn-secondary btn-sm w-full py-1 text-[11px] font-semibold mt-2 flex items-center justify-center gap-1"
                      >
                        <Send className="w-3 h-3 text-purple-400" />
                        <span>Transfer</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Quick Actions Footer */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => { onClose(); onOpenReceive(wallet); }}
              className="flex-1 sm:flex-none btn btn-secondary btn-sm py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 text-emerald-400"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>

            <button
              onClick={() => { onClose(); onOpenSend(wallet); }}
              className="flex-1 sm:flex-none btn btn-primary btn-sm py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Assets</span>
            </button>

            <button
              onClick={() => { onClose(); onOpenKeys(wallet); }}
              className="btn btn-secondary btn-sm py-2 px-2.5 text-xs font-semibold text-amber-400"
              title="Reveal 24-word seed phrase"
            >
              <Key className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => { onClose(); onOpenHistory(wallet); }}
              className="btn btn-secondary btn-sm py-2 px-2.5 text-xs font-semibold text-purple-400"
              title="View On-Chain History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!wallet.isMainWallet && onSetAsTreasury && (
              <button
                onClick={() => { onSetAsTreasury(wallet.id); onClose(); }}
                className="btn btn-gold btn-sm py-2 px-3 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Make Master Treasury</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm py-2 px-3 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
