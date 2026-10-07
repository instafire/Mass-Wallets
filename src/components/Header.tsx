import React, { useState, useEffect, useRef } from 'react';
import type { Network, VaultConfig } from '../types';
import { 
  PlusCircle, 
  Upload, 
  Download, 
  Send, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Layers, 
  KeyRound, 
  Award, 
  QrCode, 
  FileSpreadsheet, 
  Trash2,
  Crown,
  Search,
  Fuel,
  BookOpen,
  Activity,
  Keyboard,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Image as ImageIcon,
  Coins
} from 'lucide-react';
import { PriceService, type PriceData } from '../services/priceService';

interface HeaderProps {
  network?: Network;
  setNetwork?: (net: Network) => void;
  vaultConfig: VaultConfig;
  onOpenCreateVault: () => void;
  onOpenMassGenerator: () => void;
  onOpenImport: () => void;
  onOpenMassSend: () => void;
  onOpenTongramFaucet?: () => void;
  onExportVault: () => void;
  onOpenVaultSecurity: () => void;
  onOpenVaultRecovery: () => void;
  onOpenHealthAudit: () => void;
  onOpenQRSheet: () => void;
  onOpenCustomExport: () => void;
  onOpenPurgeWithBackup: () => void;
  onRefreshBalances: () => void;
  onOpenCommandPalette?: () => void;
  onOpenGasBalancer?: () => void;
  onOpenAddressBook?: () => void;
  onOpenActivityLog?: () => void;
  onOpenShortcuts?: () => void;
  onOpenNFTGallery?: () => void;
  onOpenMassNFTDisperse?: () => void;
  onOpenAddNFT?: () => void;
  onOpenSolanaAddressSheet?: () => void;
  onOpenSolanaTokenPortfolio?: () => void;
  onOpenSolanaFaucet?: () => void;
  isRefreshing: boolean;
  walletCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  network: _network,
  setNetwork: _setNetwork,
  vaultConfig,
  onOpenCreateVault,
  onOpenMassGenerator,
  onOpenImport,
  onOpenMassSend,
  onOpenTongramFaucet: _onOpenTongramFaucet,
  onExportVault,
  onOpenVaultSecurity,
  onOpenVaultRecovery,
  onOpenHealthAudit,
  onOpenQRSheet,
  onOpenCustomExport,
  onOpenPurgeWithBackup,
  onRefreshBalances,
  onOpenCommandPalette,
  onOpenGasBalancer,
  onOpenAddressBook,
  onOpenActivityLog,
  onOpenShortcuts,
  onOpenNFTGallery,
  onOpenMassNFTDisperse,
  onOpenAddNFT,
  onOpenSolanaAddressSheet,
  onOpenSolanaTokenPortfolio,
  onOpenSolanaFaucet: _onOpenSolanaFaucet,
  isRefreshing,
  walletCount,
}) => {
  const [priceData, setPriceData] = useState<PriceData>(PriceService.getPrices());
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return PriceService.subscribe(setPriceData);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsToolsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[#070a14]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        
        {/* Left: Brand Identity & Network / Price Pill */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0098EA] to-[#38bdf8] flex items-center justify-center shadow-lg shadow-[#0098EA]/30 shrink-0">
              <Layers className="w-5 h-5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#070a14] rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
                  <span>Mass Wallet</span>
                </h1>
                <span className="hidden sm:inline-flex badge badge-primary text-[10px] py-0.5 px-2">
                  Pro v2.0
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden md:block">
                Multi-Chain Institutional Bulk Wallet Engine
              </p>
            </div>
          </div>

          {/* Network Indicator & Live Price Pills */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/10">
            {/* Active Mainnet Badge */}
            <div className="flex items-center gap-1.5 bg-[#0d1424] px-2.5 py-1 rounded-xl border border-emerald-500/30 text-xs font-bold text-emerald-400 select-none shadow-sm" title="Connected to Mainnet">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Mainnet</span>
            </div>

            {/* Live TON Price Pill */}
            <div 
              className="flex items-center gap-1.5 bg-[#0d1424] px-2.5 py-1 rounded-xl border border-white/10 text-xs font-mono select-none" 
              title={priceData.source === 'live' ? `TON • Updated ${new Date(priceData.lastUpdated).toLocaleTimeString()}` : 'Price feed unreachable — showing last known values'}
            >
              <span className="text-[#0098EA] font-sans font-bold text-[11px]">TON</span>
              <span className="font-bold text-white">${(priceData.tonUsd || 0).toFixed(2)}</span>
              <span className={`text-[10px] font-bold flex items-center ${(priceData.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(priceData.change24h || 0) >= 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                {(priceData.change24h || 0) >= 0 ? '+' : ''}{(priceData.change24h || 0).toFixed(1)}%
              </span>
            </div>

            {/* Live SOL Price Pill */}
            <div 
              className="flex items-center gap-1.5 bg-[#0d1424] px-2.5 py-1 rounded-xl border border-white/10 text-xs font-mono select-none" 
              title={priceData.source === 'live' ? `SOL • Updated ${new Date(priceData.lastUpdated).toLocaleTimeString()}` : 'Price feed unreachable — showing last known values'}
            >
              <span className="text-[#14F195] font-sans font-bold text-[11px]">SOL</span>
              <span className="font-bold text-white">${(priceData.solUsd || 0).toFixed(2)}</span>
              <span className={`text-[10px] font-bold flex items-center ${(priceData.change24hSol || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(priceData.change24hSol || 0) >= 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                {(priceData.change24hSol || 0) >= 0 ? '+' : ''}{(priceData.change24hSol || 0).toFixed(1)}%
              </span>
              {priceData.source !== 'live' && (
                <span className="text-[9px] font-sans font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-1 py-px">STALE</span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Global Command Search & Quick Station Tools */}
        <div className="flex items-center gap-1.5">
          
          {/* Command Search Trigger */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 bg-[#0d1424] hover:bg-[#131d35] border border-white/10 hover:border-[#0098EA]/50 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl transition-all text-xs group"
              title="Open Command Palette (⌘K / Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-[#0098EA] group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline font-medium">Quick Jump</span>
              <kbd className="font-mono text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded border border-white/10">⌘K</kbd>
            </button>
          )}

          {/* Refresh Balances Button */}
          <button
            onClick={onRefreshBalances}
            disabled={isRefreshing || walletCount === 0}
            className="p-2 rounded-xl text-gray-300 hover:text-white bg-[#0d1424] hover:bg-[#131d35] border border-white/10 transition-all text-xs flex items-center gap-1.5 disabled:opacity-40"
            title="Refresh All Wallet Balances"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0098EA] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline font-medium">Refresh</span>
          </button>

          {/* Gas Balancer Station Button */}
          {onOpenGasBalancer && (
            <button
              onClick={onOpenGasBalancer}
              disabled={walletCount === 0}
              className="p-2 rounded-xl text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all text-xs flex items-center gap-1.5 disabled:opacity-40"
              title="Smart Gas Station & Auto-Balancer"
            >
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline font-bold">Gas Station</span>
            </button>
          )}

        </div>

        {/* Right: Primary Action + Tools Menu */}
        <div className="flex items-center gap-2">
          
          {/* Mass Generate Primary Button */}
          <button
            onClick={onOpenMassGenerator}
            className="btn btn-primary btn-sm py-2 px-3.5 shadow-lg shadow-[#0098EA]/20 font-bold"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Mass Generate</span>
            <span className="sm:hidden">Generate</span>
          </button>

          {/* Quick Disperse & NFT Gallery & Import */}
          {onOpenNFTGallery && (
            <button
              onClick={onOpenNFTGallery}
              className="btn btn-secondary btn-sm py-2 px-3 hidden lg:inline-flex font-semibold text-purple-300 hover:text-white"
              title="Open TON NFT & Collectibles Gallery"
            >
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>NFT Gallery</span>
            </button>
          )}

          {onOpenSolanaAddressSheet && (
            <button
              onClick={onOpenSolanaAddressSheet}
              className="btn btn-secondary btn-sm py-2 px-3 hidden lg:inline-flex font-semibold text-[#14F195] border-[#14F195]/30 hover:bg-[#14F195]/10"
              title="Open Solana Address & Distribution Sheet"
            >
              <Layers className="w-3.5 h-3.5 text-[#14F195]" />
              <span>Solana Sheet</span>
            </button>
          )}

          <button
            onClick={onOpenMassSend}
            disabled={walletCount === 0}
            className="btn btn-secondary btn-sm py-2 px-3 hidden md:inline-flex font-semibold"
            title="Mass Disperse TON/Tokens"
          >
            <Send className="w-3.5 h-3.5 text-[#0098EA]" />
            <span>Disperse</span>
          </button>

          <button
            onClick={onOpenImport}
            className="btn btn-secondary btn-sm py-2 px-3 hidden sm:inline-flex font-semibold"
            title="Import Seed Phrases or Private Keys"
          >
            <Upload className="w-3.5 h-3.5 text-gray-300" />
            <span>Import</span>
          </button>

          {/* Studio Tools Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsToolsDropdownOpen(!isToolsDropdownOpen)}
              className="btn btn-secondary btn-sm py-2 px-2.5 flex items-center gap-1 font-semibold"
              title="Studio Tools & Settings"
            >
              <span>Tools</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isToolsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isToolsDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-panel bg-[#090e1c] border border-white/15 rounded-2xl shadow-2xl p-2 z-50 animate-scaleUp space-y-1 text-xs">
                
                {(onOpenSolanaAddressSheet || onOpenSolanaTokenPortfolio) && (
                  <div className="pb-1 mb-1 border-b border-white/10 space-y-0.5">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#14F195]">
                      Solana Suite
                    </div>
                    {onOpenSolanaTokenPortfolio && (
                      <button
                        onClick={() => { setIsToolsDropdownOpen(false); onOpenSolanaTokenPortfolio(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left hover:bg-white/5 text-amber-300 font-semibold"
                      >
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>SPL Token Portfolio</span>
                      </button>
                    )}
                    {onOpenSolanaAddressSheet && (
                      <button
                        onClick={() => { setIsToolsDropdownOpen(false); onOpenSolanaAddressSheet(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left hover:bg-white/5 text-[#14F195] font-semibold"
                      >
                        <Layers className="w-4 h-4 text-[#14F195]" />
                        <span>Solana Address Sheet</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="px-3 py-1.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Studio Vault & Security
                </div>

                <button
                  onClick={() => { setIsToolsDropdownOpen(false); onOpenCreateVault(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-amber-300 font-semibold"
                >
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Master Treasury Vault</span>
                </button>

                <button
                  onClick={() => { setIsToolsDropdownOpen(false); onOpenVaultSecurity(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200"
                >
                  {vaultConfig.hasPin ? <Lock className="w-4 h-4 text-emerald-400" /> : <Unlock className="w-4 h-4 text-gray-400" />}
                  <span>{vaultConfig.hasPin ? 'Vault Encrypted with PIN' : 'Add PIN Security Lock'}</span>
                </button>

                <button
                  onClick={() => { setIsToolsDropdownOpen(false); onOpenVaultRecovery(); }}
                  disabled={walletCount === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200 disabled:opacity-40"
                >
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Keyphrase Recovery Center</span>
                </button>

                <button
                  onClick={() => { setIsToolsDropdownOpen(false); onOpenHealthAudit(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200"
                >
                  <Award className="w-4 h-4 text-purple-400" />
                  <span>Health & Security Audit</span>
                </button>

                <div className="px-3 py-1.5 border-b border-t border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
                  NFTs & Collectibles
                </div>

                {onOpenNFTGallery && (
                  <button
                    onClick={() => { setIsToolsDropdownOpen(false); onOpenNFTGallery(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-purple-300 font-semibold"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>NFT & Collectibles Gallery</span>
                  </button>
                )}

                {onOpenMassNFTDisperse && (
                  <button
                    onClick={() => { setIsToolsDropdownOpen(false); onOpenMassNFTDisperse(); }}
                    disabled={walletCount === 0}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 text-purple-400" />
                    <span>Mass Disperse NFTs</span>
                  </button>
                )}

                {onOpenAddNFT && (
                  <button
                    onClick={() => { setIsToolsDropdownOpen(false); onOpenAddNFT(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200"
                  >
                    <PlusCircle className="w-4 h-4 text-indigo-400" />
                    <span>Add / Mint NFT Item</span>
                  </button>
                )}

                <div className="px-3 py-1.5 border-b border-t border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
                  Studio
                </div>

                {onOpenAddressBook && (
                  <button
                    onClick={() => { setIsToolsDropdownOpen(false); onOpenAddressBook(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-purple-300 font-semibold"
                  >
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <span>Contacts & Address Book</span>
                  </button>
                )}

                {onOpenActivityLog && (
                  <button
                    onClick={() => { setIsToolsDropdownOpen(false); onOpenActivityLog(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-indigo-300 font-semibold"
                  >
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span>Activity Ledger & Audit Log</span>
                  </button>
                )}

                <div className="px-3 py-1.5 border-b border-t border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
                  Utilities & Formats
                </div>

                <button
                  onClick={() => { setIsToolsDropdownOpen(false); onOpenQRSheet(); }}
                  disabled={walletCount === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200 disabled:opacity-40"
                >
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>Printable QR Cards Sheet</span>
                </button>

                <button
                  onClick={() => { setIsToolsDropdownOpen(false); onOpenCustomExport(); }}
                  disabled={walletCount === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200 disabled:opacity-40"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  <span>Custom Format Exporter</span>
                </button>

                <button
                  onClick={() => { setIsToolsDropdownOpen(false); onExportVault(); }}
                  disabled={walletCount === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-gray-200 disabled:opacity-40"
                >
                  <Download className="w-4 h-4 text-[#0098EA]" />
                  <span>Export Vault JSON</span>
                </button>

                {walletCount > 0 && (
                  <div className="pt-1 border-t border-white/10">
                    <button
                      onClick={() => { setIsToolsDropdownOpen(false); onOpenPurgeWithBackup(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-red-500/15 text-red-400 font-semibold"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>Safe Wipe with Backup</span>
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Trigger Button */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="p-2 rounded-xl text-gray-400 hover:text-white bg-[#0d1424] hover:bg-[#131d35] border border-white/10 transition-all text-xs"
              title="Keyboard Shortcuts Cheat Sheet (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
