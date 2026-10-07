import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ManagedWallet, Network, VaultConfig, NFTItem } from './types';
import { TonService, SAMPLE_POPULAR_NFTS } from './services/tonService';
import { SolanaService } from './services/solanaService';
import { StorageService, normalizeWallets } from './services/storageService';
import { Header } from './components/Header';
import { StatsBanner } from './components/StatsBanner';
import { MainTreasuryCard } from './components/MainTreasuryCard';
import { WalletList } from './components/WalletList';
import { SolanaAddressSheetModal } from './components/SolanaAddressSheetModal';
import { SolanaTokenPortfolioModal } from './components/SolanaTokenPortfolioModal';
import { SolanaFaucetModal } from './components/SolanaFaucetModal';
import { CreateVaultWalletModal } from './components/CreateVaultWalletModal';
import { MassGeneratorModal } from './components/MassGeneratorModal';
import { ImportModal } from './components/ImportModal';
import { ReceiveModal } from './components/ReceiveModal';
import { SendModal } from './components/SendModal';
import { MassSendModal } from './components/MassSendModal';
import { MnemonicRevealModal } from './components/MnemonicRevealModal';
import { TxHistoryModal } from './components/TxHistoryModal';
import { VaultSecurityModal } from './components/VaultSecurityModal';
import { VaultRecoveryModal } from './components/VaultRecoveryModal';
import { HealthAuditModal } from './components/HealthAuditModal';
import { QRSheetModal } from './components/QRSheetModal';
import { CustomExportModal } from './components/CustomExportModal';
import { TongramFaucetModal } from './components/TongramFaucetModal';
import { EditWalletModal } from './components/EditWalletModal';
import { MainWalletDistributeModal } from './components/MainWalletDistributeModal';
import { WalletSweeperModal } from './components/WalletSweeperModal';
import { PurgeWithBackupModal } from './components/PurgeWithBackupModal';
import { UnlockVaultModal } from './components/UnlockVaultModal';
import { GasBalancerModal } from './components/GasBalancerModal';
import { CommandPalette } from './components/CommandPalette';
import { AddressBookModal } from './components/AddressBookModal';
import { ActivityLogModal } from './components/ActivityLogModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { NFTGalleryModal } from './components/NFTGalleryModal';
import { NFTSendModal } from './components/NFTSendModal';
import { MassNFTDisperseModal } from './components/MassNFTDisperseModal';
import { AddNFTModal } from './components/AddNFTModal';
import { Layers, RefreshCw } from 'lucide-react';

export function App() {
  const [wallets, setWallets] = useState<ManagedWallet[]>([]);
  const walletsRef = useRef<ManagedWallet[]>(wallets);
  walletsRef.current = wallets;
  const [network, setNetwork] = useState<Network>('mainnet');
  const [vaultConfig, setVaultConfig] = useState<VaultConfig>({ isLocked: false, hasPin: false });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshProgress, setRefreshProgress] = useState<{ done: number; total: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useState<{ timer?: any }>({})[0];

  // Active Modals
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const [isCreateVaultOpen, setIsCreateVaultOpen] = useState<boolean>(false);
  const [isMassGeneratorOpen, setIsMassGeneratorOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isMassSendOpen, setIsMassSendOpen] = useState<boolean>(false);
  const [isVaultSecurityOpen, setIsVaultSecurityOpen] = useState<boolean>(false);
  const [isVaultRecoveryOpen, setIsVaultRecoveryOpen] = useState<boolean>(false);
  const [isHealthAuditOpen, setIsHealthAuditOpen] = useState<boolean>(false);
  const [isQRSheetOpen, setIsQRSheetOpen] = useState<boolean>(false);
  const [isCustomExportOpen, setIsCustomExportOpen] = useState<boolean>(false);
  const [isTongramFaucetOpen, setIsTongramFaucetOpen] = useState<boolean>(false);
  const [isMainDistributeOpen, setIsMainDistributeOpen] = useState<boolean>(false);
  const [isWalletSweeperOpen, setIsWalletSweeperOpen] = useState<boolean>(false);
  const [isPurgeWithBackupOpen, setIsPurgeWithBackupOpen] = useState<boolean>(false);
  const [isGasBalancerOpen, setIsGasBalancerOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAddressBookOpen, setIsAddressBookOpen] = useState<boolean>(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isNFTGalleryOpen, setIsNFTGalleryOpen] = useState<boolean>(false);
  const [nftGalleryWalletId, setNftGalleryWalletId] = useState<string | undefined>(undefined);
  const [isNFTSendOpen, setIsNFTSendOpen] = useState<boolean>(false);
  const [activeNFTForSend, setActiveNFTForSend] = useState<{ nft: NFTItem; ownerWallet: ManagedWallet } | null>(null);
  const [isMassNFTDisperseOpen, setIsMassNFTDisperseOpen] = useState<boolean>(false);
  const [isAddNFTOpen, setIsAddNFTOpen] = useState<boolean>(false);
  const [addNFTTargetWalletId, setAddNFTTargetWalletId] = useState<string | undefined>(undefined);
  const [isSolanaAddressSheetOpen, setIsSolanaAddressSheetOpen] = useState<boolean>(false);
  const [solanaAddressSheetWallets, setSolanaAddressSheetWallets] = useState<ManagedWallet[]>([]);
  const [isSolanaTokenPortfolioOpen, setIsSolanaTokenPortfolioOpen] = useState<boolean>(false);
  const [isSolanaFaucetOpen, setIsSolanaFaucetOpen] = useState<boolean>(false);

  // Selected Target Wallets for specific modals
  const [activeSendWallet, setActiveSendWallet] = useState<ManagedWallet | null>(null);
  const [presetSendRecipient, setPresetSendRecipient] = useState<string>('');
  const [activeReceiveWallet, setActiveReceiveWallet] = useState<ManagedWallet | null>(null);
  const [activeRevealWallet, setActiveRevealWallet] = useState<ManagedWallet | null>(null);
  const [activeHistoryWallet, setActiveHistoryWallet] = useState<ManagedWallet | null>(null);
  const [activeEditWallet, setActiveEditWallet] = useState<ManagedWallet | null>(null);
  const [preSelectedDisperseWallets, setPreSelectedDisperseWallets] = useState<ManagedWallet[]>([]);
  const [preSelectedSweepWallets, setPreSelectedSweepWallets] = useState<ManagedWallet[]>([]);

  const handleOpenSolanaAddressSheet = (targetWallets?: ManagedWallet[]) => {
    if (targetWallets && targetWallets.length > 0) {
      setSolanaAddressSheetWallets(targetWallets);
    } else {
      const solWallets = wallets.filter(w => w.chain === 'solana' || w.version === 'solana-ed25519' || w.version === 'squads-v4');
      setSolanaAddressSheetWallets(solWallets.length > 0 ? solWallets : wallets);
    }
    setIsSolanaAddressSheetOpen(true);
  };

  const handleOpenSolanaTokenPortfolio = () => {
    setIsSolanaTokenPortfolioOpen(true);
  };

  const handleOpenSolanaFaucet = () => {
    setIsSolanaFaucetOpen(true);
  };

  const handleSolanaAirdropCompleted = (updated: ManagedWallet[]) => {
    persistWallets(updated);
    showToast('Devnet Airdrop confirmed and wallet balances updated!');
  };

  const handleSolanaTokenPortfolioSend = (tokenSymbol: string, preselectedWallet?: ManagedWallet) => {
    setIsSolanaTokenPortfolioOpen(false);
    if (preselectedWallet) {
      setActiveSendWallet(preselectedWallet);
    } else {
      const solSender = wallets.find(w => (w.chain === 'solana' || w.version === 'solana-ed25519' || w.version === 'squads-v4') && parseFloat(w.balance || '0') > 0);
      setActiveSendWallet(solSender || wallets[0] || null);
    }
    showToast(`Initiating transfer of ${tokenSymbol}`);
  };

  const showToast = (msg: string) => {
    if (toastTimeoutRef.timer) clearTimeout(toastTimeoutRef.timer);
    setToastMessage(msg);
    toastTimeoutRef.timer = setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenNFTGallery = (walletId?: string) => {
    setNftGalleryWalletId(walletId);
    setIsNFTGalleryOpen(true);
  };

  const handleOpenSendNFT = (nft: NFTItem, ownerWallet: ManagedWallet) => {
    setActiveNFTForSend({ nft, ownerWallet });
    setIsNFTSendOpen(true);
  };

  const handleOpenMassNFTDisperse = () => {
    setIsMassNFTDisperseOpen(true);
  };

  const handleOpenAddNFT = (targetWalletId?: string) => {
    setAddNFTTargetWalletId(targetWalletId);
    setIsAddNFTOpen(true);
  };

  const handleNFTAdded = (updatedWallets: ManagedWallet[]) => {
    setWallets(updatedWallets);
    StorageService.saveWallets(updatedWallets);
    showToast('NFT Collectible added to studio!');
  };

  const handleNFTTransferred = () => {
    handleRefreshBalances();
    showToast('NFT transferred successfully!');
  };

  // The explicitly designated treasury wallet. NOTE: no fallback to wallets[0] —
  // treasury actions (distribute / sweep / gas) must never silently spend from
  // an arbitrary first wallet. Components null-guard and show a designate CTA.
  const mainWallet = useMemo(() => {
    return wallets.find(w => w.isMainWallet) || null;
  }, [wallets]);

  // Load Wallets from storage on startup & ensure network scoping
  useEffect(() => {
    async function initVault() {
      const result = await StorageService.loadAllWalletsAsync();
      setVaultConfig(result.config);

      if (result.isEncrypted) {
        setIsUnlockModalOpen(true);
      } else if (result.wallets && result.wallets.length > 0) {
        const normalized = normalizeWallets(result.wallets);

        // Seed a few verified sample NFTs IN MEMORY ONLY so the gallery isn't
        // empty on first exploration. They are prefixed `demo_`, never
        // persisted, and never mixed into real holdings.
        const hasNFTs = normalized.some(w => w.nfts && w.nfts.length > 0);
        if (!hasNFTs && normalized.length > 0) {
          const main = normalized.find(w => w.isMainWallet) || normalized[0];
          main.nfts = SAMPLE_POPULAR_NFTS.slice(0, 3).map((item, idx) => ({
            ...item,
            id: `demo_nft_sample_${idx}`,
            ownerAddress: main.address,
            addedAt: Date.now() - idx * 3600000,
          }));
          if (normalized.length > 1) {
            normalized[1].nfts = [
              {
                ...SAMPLE_POPULAR_NFTS[3],
                id: `demo_nft_sample_3`,
                ownerAddress: normalized[1].address,
                addedAt: Date.now() - 7200000,
              },
            ];
          }
          // Deliberately NOT persisted: demo items must never land in the
          // vault file or be mistaken for owned assets.
        }

        setWallets(normalized);
        walletsRef.current = normalized;
        // Automatically fetch live on-chain balances on startup
        setTimeout(() => {
          handleRefreshBalances(normalized, true);
        }, 150);
      }
    }

    initVault();
  }, []);

  // Sync state to LocalStorage and IndexedDB
  const persistWallets = useCallback((updatedWallets: ManagedWallet[]) => {
    const normalized = normalizeWallets(updatedWallets);
    setWallets(normalized);
    walletsRef.current = normalized;
    StorageService.saveWallets(normalized);
  }, []);

  // Handle switching between Mainnet and Testnet
  const handleSetNetwork = (newNet: Network) => {
    setNetwork(newNet);
    const defaultJettons: any[] = [];

    const updated = wallets.map(w => {
      const netData = w.networkBalances?.[newNet];
      return {
        ...w,
        balance: netData ? netData.ton : '0.00',
        balanceNano: netData ? netData.tonNano : '0',
        jettons: netData ? netData.jettons : defaultJettons,
      };
    });

    persistWallets(updated);
    showToast(`Switched view to TON ${newNet.toUpperCase()}`);
  };

  // Refresh balances for all wallets (TON + Solana + Tokens)
  const handleRefreshBalances = useCallback(async (targetWallets?: ManagedWallet[], silent = false) => {
    const list = targetWallets || walletsRef.current;
    if (!list || list.length === 0 || isRefreshing) return;
    setIsRefreshing(true);
    setRefreshProgress({ done: 0, total: list.length });
    if (!silent) {
      showToast(`Fetching real on-chain ${network.toUpperCase()} balances (TON & Solana)...`);
    }

    try {
      const tonWallets = list.filter(w => !w.chain || w.chain === 'ton');
      const solanaWallets = list.filter(w => w.chain === 'solana');

      let completed = 0;
      const trackWallet = (w: ManagedWallet) => {
        setWallets(prev => prev.map(item => item.id === w.id ? w : item));
        completed++;
        setRefreshProgress({ done: completed, total: list.length });
      };

      let updatedTon: ManagedWallet[] = [];
      let updatedSol: ManagedWallet[] = [];

      // Run TON and Solana updates concurrently
      const [resTon, resSol] = await Promise.allSettled([
        tonWallets.length > 0 ? TonService.batchUpdateBalances(tonWallets, network, trackWallet) : Promise.resolve([]),
        solanaWallets.length > 0 ? SolanaService.batchUpdateBalances(solanaWallets, network, trackWallet) : Promise.resolve([]),
      ]);

      if (resTon.status === 'fulfilled') updatedTon = resTon.value;
      if (resSol.status === 'fulfilled') updatedSol = resSol.value;

      setRefreshProgress({ done: list.length, total: list.length });

      setWallets(prev => {
        const merged = prev.map(p => {
          const matchTon = updatedTon.find(u => u.id === p.id);
          if (matchTon) return matchTon;
          const matchSol = updatedSol.find(u => u.id === p.id);
          if (matchSol) return matchSol;
          return p;
        });
        walletsRef.current = merged;
        StorageService.saveWallets(merged);
        return merged;
      });

      const staleCount = updatedTon.filter(u => u.balanceStale).length + updatedSol.filter(u => u.balanceStale).length;
      if (!silent) {
        showToast(
          staleCount > 0
            ? `${network.toUpperCase()} balances updated — ${staleCount} wallet(s) unreachable, kept last known values.`
            : `${network.toUpperCase()} balances updated from blockchain!`
        );
      }
    } catch (e) {
      console.error('Failed to refresh balances:', e);
      if (!silent) showToast('Error refreshing balances');
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  }, [network, isRefreshing]);

  // Periodic background refresh (45s) and tab-focus refresh (detects incoming transfers immediately)
  useEffect(() => {
    const interval = setInterval(() => {
      if (walletsRef.current.length > 0 && !isRefreshing) {
        handleRefreshBalances(undefined, true);
      }
    }, 45000);

    const onFocus = () => {
      if (walletsRef.current.length > 0 && !isRefreshing) {
        handleRefreshBalances(undefined, true);
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [handleRefreshBalances, isRefreshing]);

  // Vault Wallet created
  const handleVaultCreated = (newVault: ManagedWallet) => {
    const updated = [newVault, ...wallets.map(w => ({ ...w, isMainWallet: false }))];
    persistWallets(updated);
    showToast(`Master Vault Wallet (${newVault.version}) created & backup saved to Drive!`);
  };

  // Add newly created wallets (persisted immediately)
  const handleWalletsCreated = (newWallets: ManagedWallet[]) => {
    const combined = [...wallets, ...newWallets];
    persistWallets(combined);
    showToast(`Added & Saved ${newWallets.length} new wallets with keyphrases to Vault!`);
  };

  // Set first wallet as main
  const handleSetFirstAsMain = () => {
    if (wallets.length === 0) return;
    const updated = wallets.map((w, idx) => ({ ...w, isMainWallet: idx === 0 }));
    persistWallets(updated);
    showToast(`"${wallets[0].label}" is now designated as Master Treasury!`);
  };

  // Add imported wallets
  const handleWalletsImported = (importedWallets: ManagedWallet[]) => {
    const combined = [...wallets, ...importedWallets];
    persistWallets(combined);
    showToast(`Imported & Saved ${importedWallets.length} wallets!`);
  };

  // Save edited wallet
  const handleSaveEditedWallet = (updated: ManagedWallet) => {
    const next = wallets.map(w => w.id === updated.id ? updated : w);
    persistWallets(next);
    showToast(`Updated "${updated.label}" info!`);
  };

  // Faucet funding
  const handleFaucetFunded = (fundedWallets: ManagedWallet[], msg: string) => {
    persistWallets(fundedWallets);
    showToast(msg);
  };

  // Delete single wallet
  const handleDeleteWallet = (id: string) => {
    const filtered = wallets.filter(w => w.id !== id);
    persistWallets(filtered);
    showToast('Wallet removed from Studio');
  };

  // Delete bulk wallets
  const handleDeleteBulkWallets = (ids: string[]) => {
    const set = new Set(ids);
    const filtered = wallets.filter(w => !set.has(w.id));
    persistWallets(filtered);
    showToast(`Removed ${ids.length} wallet(s)`);
  };

  // Purge all wallets after automatic file download
  const handlePurgeAllWallets = () => {
    StorageService.clearAllWallets();
    setWallets([]);
    showToast('All wallets archived to disk and removed from app view.');
  };

  // Export Master Vault Backup
  const handleExportVault = () => {
    StorageService.exportFullMasterBackup(wallets, network);
    showToast('Exported Master Vault Backup JSON file!');
  };

  const handleOpenMassSendWithRecipients = (recipients: ManagedWallet[]) => {
    setPreSelectedDisperseWallets(recipients);
    setIsMassSendOpen(true);
  };

  const handleOpenSweepWithSources = (sources: ManagedWallet[]) => {
    setPreSelectedSweepWallets(sources);
    setIsWalletSweeperOpen(true);
  };

  const handleBatchTagUpdated = (updatedWallets: ManagedWallet[]) => {
    persistWallets(updatedWallets);
    showToast(`Updated tags & batch organization!`);
  };

  // Global Keyboard Shortcuts (Cmd+K, Ctrl+K, ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-gray-100 selection:bg-[#0098EA] selection:text-white">
      
      {/* Navbar */}
      <Header
        network={network}
        setNetwork={handleSetNetwork}
        vaultConfig={vaultConfig}
        onOpenCreateVault={() => setIsCreateVaultOpen(true)}
        onOpenMassGenerator={() => setIsMassGeneratorOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenMassSend={() => {
          setPreSelectedDisperseWallets([]);
          setIsMassSendOpen(true);
        }}
        onOpenTongramFaucet={() => setIsTongramFaucetOpen(true)}
        onExportVault={handleExportVault}
        onOpenVaultSecurity={() => setIsVaultSecurityOpen(true)}
        onOpenVaultRecovery={() => setIsVaultRecoveryOpen(true)}
        onOpenHealthAudit={() => setIsHealthAuditOpen(true)}
        onOpenQRSheet={() => setIsQRSheetOpen(true)}
        onOpenCustomExport={() => setIsCustomExportOpen(true)}
        onOpenPurgeWithBackup={() => setIsPurgeWithBackupOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenGasBalancer={() => setIsGasBalancerOpen(true)}
        onOpenAddressBook={() => setIsAddressBookOpen(true)}
        onOpenActivityLog={() => setIsActivityLogOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenNFTGallery={() => handleOpenNFTGallery()}
        onOpenMassNFTDisperse={handleOpenMassNFTDisperse}
        onOpenAddNFT={() => handleOpenAddNFT()}
        onOpenSolanaAddressSheet={() => handleOpenSolanaAddressSheet()}
        onOpenSolanaTokenPortfolio={handleOpenSolanaTokenPortfolio}
        onOpenSolanaFaucet={handleOpenSolanaFaucet}
        onRefreshBalances={handleRefreshBalances}
        isRefreshing={isRefreshing}
        walletCount={wallets.length}
      />

      {/* Balance refresh progress (2k+ wallets take a while against free RPC limits) */}
      {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-2">
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0098EA] shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0098EA] to-emerald-400 transition-all duration-200"
                style={{ width: `${Math.round((refreshProgress.done / refreshProgress.total) * 100)}%` }}
              />
            </div>
            <span className="font-mono whitespace-nowrap">
              {refreshProgress.done}/{refreshProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* Stats Metrics Banner */}
        <StatsBanner 
          wallets={wallets} 
          network={network} 
          onOpenGasBalancer={() => setIsGasBalancerOpen(true)}
          onOpenNFTGallery={() => handleOpenNFTGallery()}
        />

        {/* Master Treasury Main Wallet Hub Banner */}
        <MainTreasuryCard
          mainWallet={mainWallet}
          allWallets={wallets}
          network={network}
          onOpenDistribute={() => setIsMainDistributeOpen(true)}
          onOpenSweep={() => {
            setPreSelectedSweepWallets([]);
            setIsWalletSweeperOpen(true);
          }}
          onOpenGasBalancer={() => setIsGasBalancerOpen(true)}
          onOpenNFTGallery={() => handleOpenNFTGallery(mainWallet?.id)}
          onOpenReceive={(w) => setActiveReceiveWallet(w)}
          onOpenSend={(w) => setActiveSendWallet(w)}
          onOpenKeys={(w) => setActiveRevealWallet(w)}
          onOpenHistory={(w) => setActiveHistoryWallet(w)}
          onSetFirstAsMain={handleSetFirstAsMain}
          onCreateMainWallet={() => setIsCreateVaultOpen(true)}
        />

        {/* Managed Wallet List & High-Speed Explorer */}
        <WalletList
          wallets={wallets}
          network={network}
          mainWallet={mainWallet}
          onSend={(w) => setActiveSendWallet(w)}
          onReceive={(w) => setActiveReceiveWallet(w)}
          onRevealMnemonic={(w) => setActiveRevealWallet(w)}
          onViewHistory={(w) => setActiveHistoryWallet(w)}
          onEditWallet={(w) => setActiveEditWallet(w)}
          onViewNFTs={(w) => handleOpenNFTGallery(w.id)}
          onDeleteWallet={handleDeleteWallet}
          onDeleteBulkWallets={handleDeleteBulkWallets}
          onOpenMassGenerator={() => setIsMassGeneratorOpen(true)}
          onOpenMassSendWithRecipients={handleOpenMassSendWithRecipients}
          onOpenSweepWithSources={handleOpenSweepWithSources}
          onOpenMassNFTDisperse={handleOpenMassNFTDisperse}
          onBatchTagUpdated={handleBatchTagUpdated}
          onOpenSolanaAddressSheet={handleOpenSolanaAddressSheet}
          onOpenSolanaTokenPortfolio={handleOpenSolanaTokenPortfolio}
          onOpenSolanaFaucet={handleOpenSolanaFaucet}
        />

      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-gray-400 bg-[#060913]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0098EA]" />
            <span className="font-bold text-gray-200">TON Mass Wallet Studio</span>
          </div>
          <p>© 2026 TON Ecosystem • Institutional Bulk Engine</p>
        </div>
      </footer>

      {/* Modals */}
      <UnlockVaultModal
        isOpen={isUnlockModalOpen}
        onUnlocked={(unlockedWallets) => {
          setWallets(unlockedWallets);
          setIsUnlockModalOpen(false);
          showToast(`Vault unlocked! Loaded ${unlockedWallets.length} wallets.`);
        }}
      />

      <CreateVaultWalletModal
        isOpen={isCreateVaultOpen}
        onClose={() => setIsCreateVaultOpen(false)}
        onVaultCreated={handleVaultCreated}
      />

      <MassGeneratorModal
        isOpen={isMassGeneratorOpen}
        onClose={() => setIsMassGeneratorOpen(false)}
        onWalletsCreated={handleWalletsCreated}
        onOpenAddressSheet={(created) => handleOpenSolanaAddressSheet(created)}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onWalletsImported={handleWalletsImported}
      />

      <ReceiveModal
        isOpen={!!activeReceiveWallet}
        onClose={() => setActiveReceiveWallet(null)}
        wallet={activeReceiveWallet}
        network={network}
      />

      <SendModal
        isOpen={!!activeSendWallet}
        onClose={() => {
          setActiveSendWallet(null);
          setPresetSendRecipient('');
        }}
        senderWallet={activeSendWallet}
        allWallets={wallets}
        network={network}
        initialRecipient={presetSendRecipient}
        onTxSent={() => {
          showToast('Transaction sent!');
          handleRefreshBalances();
        }}
      />

      <MassSendModal
        isOpen={isMassSendOpen}
        onClose={() => setIsMassSendOpen(false)}
        senderWallets={wallets}
        preSelectedRecipients={preSelectedDisperseWallets}
        network={network}
        onMassSendCompleted={() => {
          showToast('Mass transfer operation completed!');
          handleRefreshBalances();
        }}
      />

      <MnemonicRevealModal
        isOpen={!!activeRevealWallet}
        onClose={() => setActiveRevealWallet(null)}
        wallet={activeRevealWallet}
        vaultConfig={vaultConfig}
      />

      <TxHistoryModal
        isOpen={!!activeHistoryWallet}
        onClose={() => setActiveHistoryWallet(null)}
        wallet={activeHistoryWallet}
        network={network}
      />

      <VaultSecurityModal
        isOpen={isVaultSecurityOpen}
        onClose={() => setIsVaultSecurityOpen(false)}
        vaultConfig={vaultConfig}
        wallets={wallets}
        onVaultConfigUpdated={() => {
          setVaultConfig(StorageService.getVaultConfig());
          showToast('Vault security configuration updated!');
        }}
      />

      <VaultRecoveryModal
        isOpen={isVaultRecoveryOpen}
        onClose={() => setIsVaultRecoveryOpen(false)}
        wallets={wallets}
        vaultConfig={vaultConfig}
        network={network}
      />

      <HealthAuditModal
        isOpen={isHealthAuditOpen}
        onClose={() => setIsHealthAuditOpen(false)}
        wallets={wallets}
        vaultConfig={vaultConfig}
        onOpenSecurity={() => setIsVaultSecurityOpen(true)}
        onOpenRecovery={() => setIsVaultRecoveryOpen(true)}
      />

      <QRSheetModal
        isOpen={isQRSheetOpen}
        onClose={() => setIsQRSheetOpen(false)}
        wallets={wallets}
      />

      <CustomExportModal
        isOpen={isCustomExportOpen}
        onClose={() => setIsCustomExportOpen(false)}
        wallets={wallets}
      />

      <TongramFaucetModal
        isOpen={isTongramFaucetOpen}
        onClose={() => setIsTongramFaucetOpen(false)}
        wallets={wallets}
        network={network}
        onFundWallets={handleFaucetFunded}
      />

      <EditWalletModal
        isOpen={!!activeEditWallet}
        onClose={() => setActiveEditWallet(null)}
        wallet={activeEditWallet}
        onSave={handleSaveEditedWallet}
      />

      {/* Main Treasury Distribution Pop-up Modal */}
      <MainWalletDistributeModal
        isOpen={isMainDistributeOpen}
        onClose={() => setIsMainDistributeOpen(false)}
        mainWallet={mainWallet}
        recipientWallets={wallets}
        network={network}
        onDistributionComplete={() => {
          showToast('Treasury mass distribution completed!');
          handleRefreshBalances();
        }}
      />

      {/* Wallet Sweeper / Consolidator Modal */}
      <WalletSweeperModal
        isOpen={isWalletSweeperOpen}
        onClose={() => setIsWalletSweeperOpen(false)}
        mainWallet={mainWallet}
        allWallets={wallets}
        sourceWallets={preSelectedSweepWallets}
        network={network}
        onSweepComplete={() => {
          showToast('Sub-wallets swept to Master Treasury successfully!');
          handleRefreshBalances();
        }}
      />

      {/* Purge With Automatic Backup Modal */}
      <PurgeWithBackupModal
        isOpen={isPurgeWithBackupOpen}
        onClose={() => setIsPurgeWithBackupOpen(false)}
        wallets={wallets}
        network={network}
        onPurgeCompleted={handlePurgeAllWallets}
      />

      {/* Smart Gas Station & Auto-Balancer Modal */}
      <GasBalancerModal
        isOpen={isGasBalancerOpen}
        onClose={() => setIsGasBalancerOpen(false)}
        mainWallet={mainWallet}
        allWallets={wallets}
        network={network}
        onGasBalancingCompleted={() => {
          showToast('Smart Gas Auto-Balancing completed!');
          handleRefreshBalances();
        }}
      />

      {/* Command Palette & Fuzzy Finder (Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        wallets={wallets}
        network={network}
        setNetwork={handleSetNetwork}
        onOpenCreateVault={() => setIsCreateVaultOpen(true)}
        onOpenMassGenerator={() => setIsMassGeneratorOpen(true)}
        onOpenMassSend={() => {
          setPreSelectedDisperseWallets([]);
          setIsMassSendOpen(true);
        }}
        onOpenDistribute={() => setIsMainDistributeOpen(true)}
        onOpenSweep={() => {
          setPreSelectedSweepWallets([]);
          setIsWalletSweeperOpen(true);
        }}
        onOpenGasBalancer={() => setIsGasBalancerOpen(true)}
        onOpenAddressBook={() => setIsAddressBookOpen(true)}
        onOpenActivityLog={() => setIsActivityLogOpen(true)}
        onOpenHealthAudit={() => setIsHealthAuditOpen(true)}
        onOpenTongramFaucet={() => setIsTongramFaucetOpen(true)}
        onOpenExportVault={handleExportVault}
        onOpenNFTGallery={() => handleOpenNFTGallery()}
        onOpenMassNFTDisperse={handleOpenMassNFTDisperse}
        onOpenAddNFT={() => handleOpenAddNFT()}
        onOpenSolanaAddressSheet={() => handleOpenSolanaAddressSheet()}
        onOpenSolanaTokenPortfolio={handleOpenSolanaTokenPortfolio}
        onOpenSolanaFaucet={handleOpenSolanaFaucet}
        onSelectWallet={(w) => setActiveSendWallet(w)}
      />

      {/* Address Book & Saved Contacts Modal */}
      <AddressBookModal
        isOpen={isAddressBookOpen}
        onClose={() => setIsAddressBookOpen(false)}
        network={network}
        onSendToContact={(dest) => {
          const sender = mainWallet || (wallets.length > 0 ? wallets[0] : null);
          if (sender) {
            setActiveSendWallet(sender);
            setPresetSendRecipient(dest);
          }
        }}
      />

      {/* Studio Activity Ledger & Audit Log Modal */}
      <ActivityLogModal
        isOpen={isActivityLogOpen}
        onClose={() => setIsActivityLogOpen(false)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* TON NFT & Collectibles Gallery Modal */}
      <NFTGalleryModal
        isOpen={isNFTGalleryOpen}
        onClose={() => setIsNFTGalleryOpen(false)}
        wallets={wallets}
        network={network}
        initialWalletId={nftGalleryWalletId}
        onOpenSendNFT={handleOpenSendNFT}
        onOpenAddNFT={handleOpenAddNFT}
      />

      {/* Single NFT Transfer Modal */}
      <NFTSendModal
        isOpen={isNFTSendOpen}
        onClose={() => {
          setIsNFTSendOpen(false);
          setActiveNFTForSend(null);
        }}
        nft={activeNFTForSend?.nft || null}
        senderWallet={activeNFTForSend?.ownerWallet || null}
        allWallets={wallets}
        network={network}
        onOpenAddressBook={() => setIsAddressBookOpen(true)}
        onNFTTransferred={handleNFTTransferred}
      />

      {/* Mass NFT Batch Disperse & Drop Modal */}
      <MassNFTDisperseModal
        isOpen={isMassNFTDisperseOpen}
        onClose={() => setIsMassNFTDisperseOpen(false)}
        wallets={wallets}
        network={network}
        mainWallet={mainWallet}
        onDistributionComplete={() => {
          showToast('Mass NFT Drop completed!');
          handleRefreshBalances();
        }}
      />

      {/* Add / Mint Collectible NFT Modal */}
      <AddNFTModal
        isOpen={isAddNFTOpen}
        onClose={() => setIsAddNFTOpen(false)}
        wallets={wallets}
        network={network}
        initialTargetWalletId={addNFTTargetWalletId}
        onNFTAdded={handleNFTAdded}
      />

      {/* Solana Easy Address Sheet Modal */}
      <SolanaAddressSheetModal
        isOpen={isSolanaAddressSheetOpen}
        onClose={() => setIsSolanaAddressSheetOpen(false)}
        wallets={solanaAddressSheetWallets.length > 0 ? solanaAddressSheetWallets : wallets}
        onOpenDistributeToThese={(targets) => {
          setIsSolanaAddressSheetOpen(false);
          handleOpenMassSendWithRecipients(targets);
        }}
      />

      {/* Solana SPL Token Portfolio Modal */}
      <SolanaTokenPortfolioModal
        isOpen={isSolanaTokenPortfolioOpen}
        onClose={() => setIsSolanaTokenPortfolioOpen(false)}
        wallets={wallets}
        network={network}
        onOpenSendToken={handleSolanaTokenPortfolioSend}
        onFilterByToken={(_tokenSymbol) => {
          showToast(`Filtered studio wallets for ${_tokenSymbol}`);
        }}
        onRefreshBalances={handleRefreshBalances}
      />

      {/* Solana Devnet Airdrop Faucet Modal */}
      <SolanaFaucetModal
        isOpen={isSolanaFaucetOpen}
        onClose={() => setIsSolanaFaucetOpen(false)}
        wallets={wallets}
        network={network}
        onAirdropCompleted={handleSolanaAirdropCompleted}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="toast">
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
export default App;
