import React, { useState, useMemo } from 'react';
import type { ManagedWallet, Network } from '../types';
import { SUPPORTED_SOLANA_TOKENS, SolanaService } from '../services/solanaService';
import { PriceService } from '../services/priceService';
import { 
  X, 
  Coins, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Send, 
  Filter, 
  Plus, 
  RefreshCw,
  Wallet,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface SolanaTokenPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  network: Network;
  onOpenSendToken?: (tokenSymbol: string, preselectedWallet?: ManagedWallet) => void;
  onFilterByToken?: (tokenSymbol: string) => void;
  onRefreshBalances?: () => void;
}

interface AggregatedToken {
  symbol: string;
  name: string;
  mintAddress: string;
  decimals: number;
  icon?: string;
  totalBalance: number;
  usdPrice: number;
  totalUsdValue: number;
  holderWallets: Array<{
    wallet: ManagedWallet;
    balance: string;
    usdValue: string;
  }>;
}

export const SolanaTokenPortfolioModal: React.FC<SolanaTokenPortfolioModalProps> = ({
  isOpen,
  onClose,
  wallets,
  network,
  onOpenSendToken,
  onFilterByToken,
  onRefreshBalances,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customMintInput, setCustomMintInput] = useState<string>('');
  const [customMintLoading, setCustomMintLoading] = useState<boolean>(false);
  const [customMintError, setCustomMintError] = useState<string | null>(null);
  const [customTrackedMints, setCustomTrackedMints] = useState<string[]>([]);

  // Filter only Solana wallets
  const solanaWallets = useMemo(() => {
    return wallets.filter(w => w.chain === 'solana' || w.version === 'solana-ed25519' || w.version === 'squads-v4');
  }, [wallets]);

  // Aggregate all SPL tokens across all Solana wallets
  const aggregatedTokens = useMemo(() => {
    const tokenMap = new Map<string, AggregatedToken>();

    // 1. Initialize with supported tokens so they can be viewed even if balance is 0
    SUPPORTED_SOLANA_TOKENS.forEach(t => {
      if (t.symbol === 'SOL') return; // Native SOL is displayed in main balance
      tokenMap.set(t.masterAddress, {
        symbol: t.symbol,
        name: t.name,
        mintAddress: t.masterAddress,
        decimals: t.decimals,
        icon: t.icon,
        totalBalance: 0,
        usdPrice: t.usdPrice || 0,
        totalUsdValue: 0,
        holderWallets: [],
      });
    });

    // 2. Iterate through all wallets and their jettons / SPL tokens
    solanaWallets.forEach(wallet => {
      const tokens = wallet.jettons || [];
      tokens.forEach(tok => {
        if (tok.symbol === 'SOL' || tok.symbol === 'TON') return;
        const mint = tok.jettonAddress || tok.symbol;
        const balNum = parseFloat(tok.balance || '0');

        let entry = tokenMap.get(mint);
        if (!entry) {
          // Check if matches a known symbol
          const known = SUPPORTED_SOLANA_TOKENS.find(st => st.symbol.toUpperCase() === tok.symbol.toUpperCase());
          const price = known?.usdPrice || (PriceService.getPrices().tokens[tok.symbol.toUpperCase()] || 0);
          entry = {
            symbol: tok.symbol,
            name: tok.name || tok.symbol,
            mintAddress: known?.masterAddress || mint,
            decimals: tok.decimals || 6,
            icon: tok.icon || '🪙',
            totalBalance: 0,
            usdPrice: price,
            totalUsdValue: 0,
            holderWallets: [],
          };
          tokenMap.set(mint, entry);
        }

        if (balNum > 0) {
          entry.totalBalance += balNum;
          entry.totalUsdValue += balNum * entry.usdPrice;
          entry.holderWallets.push({
            wallet,
            balance: tok.balance,
            usdValue: (balNum * entry.usdPrice).toFixed(2),
          });
        }
      });
    });

    return Array.from(tokenMap.values());
  }, [solanaWallets, customTrackedMints]);

  // Filtered tokens based on search
  const filteredTokens = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return aggregatedTokens;
    return aggregatedTokens.filter(t => 
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.mintAddress.toLowerCase().includes(q)
    );
  }, [aggregatedTokens, searchTerm]);

  // Stats
  const totalUsdPortfolio = useMemo(() => {
    return aggregatedTokens.reduce((sum, t) => sum + t.totalUsdValue, 0);
  }, [aggregatedTokens]);

  const tokensWithHoldersCount = useMemo(() => {
    return aggregatedTokens.filter(t => t.holderWallets.length > 0).length;
  }, [aggregatedTokens]);

  const totalHoldersAcrossTokens = useMemo(() => {
    const holdersSet = new Set<string>();
    aggregatedTokens.forEach(t => {
      t.holderWallets.forEach(h => holdersSet.add(h.wallet.id));
    });
    return holdersSet.size;
  }, [aggregatedTokens]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTrackCustomMint = async (e: React.FormEvent) => {
    e.preventDefault();
    const mint = customMintInput.trim();
    if (!mint) return;

    if (!SolanaService.isValidAddress(mint)) {
      setCustomMintError('Invalid Solana mint address (must be valid 32-byte Base58).');
      return;
    }

    setCustomMintLoading(true);
    setCustomMintError(null);
    try {
      if (!customTrackedMints.includes(mint)) {
        setCustomTrackedMints(prev => [...prev, mint]);
      }
      setCustomMintInput('');
    } catch (err: any) {
      setCustomMintError(err?.message || 'Failed to track mint');
    } finally {
      setCustomMintLoading(false);
    }
  };

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9945FF]/30 to-[#14F195]/20 border border-[#14F195]/30 text-[#14F195] flex items-center justify-center shadow-lg">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Solana SPL Token Portfolio</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30">
                  {network.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Aggregated token holdings, mint contracts, and balances across {solanaWallets.length} Solana studio wallets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshBalances && (
              <button
                type="button"
                onClick={onRefreshBalances}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                title="Refresh On-Chain Balances"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Portfolio Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
          <div className="glass-card p-4 bg-[#080d1a] border-white/5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              Est. SPL Token Valuation
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#14F195] font-mono">
                ${totalUsdPortfolio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-gray-400">USD</span>
            </div>
          </div>

          <div className="glass-card p-4 bg-[#080d1a] border-white/5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              Active SPL Tokens
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white font-mono">
                {tokensWithHoldersCount}
              </span>
              <span className="text-xs text-gray-400">held / {aggregatedTokens.length} tracked</span>
            </div>
          </div>

          <div className="glass-card p-4 bg-[#080d1a] border-white/5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              Holder Wallets
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-purple-400 font-mono">
                {totalHoldersAcrossTokens}
              </span>
              <span className="text-xs text-gray-400">wallets holding tokens</span>
            </div>
          </div>
        </div>

        {/* Search & Custom Mint Input */}
        <div className="space-y-3 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by symbol, token name, or mint address..."
                className="input-field pl-10 py-2.5 text-xs w-full"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Custom Mint Form */}
            <form onSubmit={handleTrackCustomMint} className="flex gap-2">
              <input
                type="text"
                value={customMintInput}
                onChange={(e) => setCustomMintInput(e.target.value)}
                placeholder="Paste Custom SPL Mint..."
                className="input-field py-2 text-xs w-48 font-mono"
              />
              <button
                type="submit"
                disabled={!customMintInput.trim() || customMintLoading}
                className="btn btn-secondary btn-sm py-2 px-3 text-xs flex items-center gap-1 text-[#14F195] border-[#14F195]/30 hover:bg-[#14F195]/10 shrink-0"
                title="Track Custom Token Mint"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Track Mint</span>
              </button>
            </form>
          </div>

          {customMintError && (
            <p className="text-xs text-red-400">{customMintError}</p>
          )}
        </div>

        {/* Tokens List / Table */}
        <div className="space-y-2">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-12 glass-card border-dashed border-white/10 text-gray-400 text-xs">
              No SPL tokens matching your search criteria.
            </div>
          ) : (
            filteredTokens.map((token) => {
              const isExpanded = expandedToken === token.mintAddress;
              const hasHolders = token.holderWallets.length > 0;

              return (
                <div 
                  key={token.mintAddress}
                  className={`glass-card p-4 transition-all duration-200 border-white/5 ${
                    isExpanded ? 'ring-1 ring-[#14F195]/40 bg-[#0f172a]' : 'hover:border-white/15'
                  }`}
                >
                  {/* Token Row Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#121b30] border border-white/10 flex items-center justify-center text-lg shrink-0">
                        {token.icon || '🪙'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-sm">{token.symbol}</h4>
                          <span className="text-xs text-gray-400">({token.name})</span>
                          {token.mintAddress.endsWith('pump') && (
                            <a
                              href={`https://pump.fun/coin/${token.mintAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 flex items-center gap-1"
                              title="View coin on pump.fun"
                            >
                              <span>💊 pump.fun</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          {token.usdPrice > 0 && (
                            <span className="text-[11px] text-gray-400 font-mono">
                              ${token.usdPrice.toFixed(token.usdPrice < 0.0001 ? 8 : 2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-gray-400 truncate max-w-[200px] sm:max-w-[260px]">
                            {token.mintAddress.substring(0, 10)}...{token.mintAddress.substring(token.mintAddress.length - 8)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(token.mintAddress, `mint_${token.mintAddress}`)}
                            className="text-gray-400 hover:text-white"
                            title="Copy Mint Address"
                          >
                            {copiedKey === `mint_${token.mintAddress}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <a
                            href={`https://solscan.io/token/${token.mintAddress}${network === 'testnet' ? '?cluster=devnet' : ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[#14F195]"
                            title="View on Solscan"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Balance & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                      <div className="text-left sm:text-right">
                        <div className="font-extrabold text-white font-mono text-sm">
                          {token.totalBalance.toLocaleString('en-US', { maximumFractionDigits: token.decimals > 4 ? 4 : token.decimals })} {token.symbol}
                        </div>
                        <div className="text-[11px] text-[#14F195] font-mono font-semibold">
                          ≈ ${token.totalUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenSendToken && (
                          <button
                            type="button"
                            onClick={() => onOpenSendToken(token.symbol)}
                            className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5 text-[#14F195] border-[#14F195]/30 hover:bg-[#14F195]/10 flex items-center gap-1 font-semibold"
                            title={`Send / Disperse ${token.symbol}`}
                          >
                            <Send className="w-3 h-3" />
                            <span>Send</span>
                          </button>
                        )}

                        {onFilterByToken && hasHolders && (
                          <button
                            type="button"
                            onClick={() => {
                              onFilterByToken(token.symbol);
                              onClose();
                            }}
                            className="btn btn-secondary btn-sm text-[11px] py-1 px-2 text-gray-300 hover:text-white"
                            title="Filter Studio View to Holders of this Token"
                          >
                            <Filter className="w-3 h-3" />
                          </button>
                        )}

                        {hasHolders && (
                          <button
                            type="button"
                            onClick={() => setExpandedToken(isExpanded ? null : token.mintAddress)}
                            className="btn btn-secondary btn-sm text-[11px] py-1 px-2 text-gray-300 flex items-center gap-1"
                            title="Toggle Holder Wallets List"
                          >
                            <span>{token.holderWallets.length} {token.holderWallets.length === 1 ? 'Holder' : 'Holders'}</span>
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Holder Wallets List */}
                  {isExpanded && hasHolders && (
                    <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold px-2">
                        <span>Holding Wallet</span>
                        <span>Balance & Actions</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-white/5 bg-[#080d1a] rounded-xl border border-white/5">
                        {token.holderWallets.map(h => (
                          <div 
                            key={h.wallet.id}
                            className="p-2.5 flex items-center justify-between hover:bg-white/5 transition-all text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Wallet className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <div>
                                <span className="font-bold text-white text-xs">{h.wallet.label}</span>
                                <span className="font-mono text-[10px] text-gray-400 block">
                                  {h.wallet.address.substring(0, 6)}...{h.wallet.address.substring(h.wallet.address.length - 6)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="font-mono font-bold text-amber-400">{h.balance} {token.symbol}</span>
                                <span className="text-[10px] text-gray-400 block font-mono">≈ ${h.usdValue}</span>
                              </div>
                              {onOpenSendToken && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSendToken(token.symbol, h.wallet)}
                                  className="text-gray-400 hover:text-[#14F195] p-1 rounded hover:bg-white/5"
                                  title={`Send ${token.symbol} from this wallet`}
                                >
                                  <Send className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <span>
            {solanaWallets.length} total Solana studio wallets checked
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm px-4"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
