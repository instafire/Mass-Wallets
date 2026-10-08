import React, { useState, useMemo, useEffect } from "react";
import type { ManagedWallet, Network } from "../types";
import { isSolanaWallet } from "../types";
import { WalletCard } from "./WalletCard";
import { QuickQRPopover } from "./QuickQRPopover";
import { BatchTagModal } from "./BatchTagModal";
import { StorageService } from "../services/storageService";
import { PriceService } from "../services/priceService";
import { 
  Search, 
  Grid, 
  List as ListIcon, 
  FolderGit2, 
  Trash2, 
  Copy, 
  Check, 
  Send, 
  Sparkles, 
  Layers, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  QrCode, 
  Key, 
  History, 
  Crown, 
  ArrowDownToLine, 
  Tag, 
  Fuel, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  SlidersHorizontal,
  X,
  Coins,
  Droplets,
  FileCode,
  FileText,
  FileSpreadsheet,
  Zap
} from "lucide-react";

interface WalletListProps {
  wallets: ManagedWallet[];
  network?: Network;
  mainWallet?: ManagedWallet | null;
  onSend: (wallet: ManagedWallet) => void;
  onReceive: (wallet: ManagedWallet) => void;
  onRevealMnemonic: (wallet: ManagedWallet) => void;
  onViewHistory: (wallet: ManagedWallet) => void;
  onEditWallet?: (wallet: ManagedWallet) => void;
  onViewNFTs?: (wallet: ManagedWallet) => void;
  onDeleteWallet: (id: string) => void;
  onDeleteBulkWallets: (ids: string[]) => void;
  onOpenMassGenerator: () => void;
  onOpenMassSendWithRecipients?: (wallets: ManagedWallet[]) => void;
  onOpenSweepWithSources?: (wallets: ManagedWallet[]) => void;
  onOpenMassNFTDisperse?: () => void;
  onBatchTagUpdated?: (updatedWallets: ManagedWallet[]) => void;
  onOpenSolanaAddressSheet?: (wallets: ManagedWallet[]) => void;
  onOpenSolanaTokenPortfolio?: () => void;
  onOpenSolanaFaucet?: () => void;
  onViewHoldings?: (wallet: ManagedWallet) => void;
  onSetAsTreasury?: (walletId: string) => void;
  onOpenSolanaCostEstimator?: (tokenSymbol?: string) => void;
}

type ViewMode = "matrix" | "batches" | "grid";
type SortOption = "index-asc" | "index-desc" | "balance-desc" | "balance-asc" | "label" | "tag" | "newest";
type FilterOption = "all" | "funded" | "empty" | "low-gas" | "nfts" | "treasury";

export const WalletList: React.FC<WalletListProps> = ({
  wallets,
  network = "mainnet",
  mainWallet: _mainWallet,
  onSend,
  onReceive,
  onRevealMnemonic,
  onViewHistory,
  onEditWallet,
  onViewNFTs,
  onViewHoldings,
  onSetAsTreasury,
  onDeleteWallet,
  onDeleteBulkWallets,
  onOpenMassGenerator,
  onOpenMassSendWithRecipients,
  onOpenSweepWithSources,
  onOpenMassNFTDisperse,
  onBatchTagUpdated,
  onOpenSolanaAddressSheet,
  onOpenSolanaTokenPortfolio,
  onOpenSolanaFaucet,
  onOpenSolanaCostEstimator,
}) => {
  // View & Filter States
  const [viewMode, setViewMode] = useState<ViewMode>("matrix");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedChain, setSelectedChain] = useState<"all" | "ton" | "solana">("all");
  const [selectedTokenFilter, setSelectedTokenFilter] = useState<string>("all");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");

  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedVersion, setSelectedVersion] = useState<string>("all");
  const [sortOption, setSortOption] = useState<SortOption>("index-asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Multi-Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedBulk, setCopiedBulk] = useState<boolean>(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  // Modals & Popovers
  const [activeQRPopoverWallet, setActiveQRPopoverWallet] = useState<ManagedWallet | null>(null);
  const [isBatchTagOpen, setIsBatchTagOpen] = useState<boolean>(false);
  const [isRangeSelectorOpen, setIsRangeSelectorOpen] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<string>("1");
  const [rangeEnd, setRangeEnd] = useState<string>("100");
  const [jumpIndex, setJumpIndex] = useState<string>("");
  const [collapsedBatches, setCollapsedBatches] = useState<Set<string>>(new Set());

  // Indexed lookup map for 1-based original index numbers
  const walletIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    wallets.forEach((w, idx) => {
      map.set(w.id, idx + 1);
    });
    return map;
  }, [wallets]);

  // Unique tags list
  const tags = useMemo(() => {
    const set = new Set<string>();
    wallets.forEach(w => {
      if (w.tag) set.add(w.tag);
    });
    return Array.from(set);
  }, [wallets]);

  const isWalletFunded = (w: ManagedWallet) => {
    if (parseFloat(w.balance || "0") > 0) return true;
    return !!w.jettons?.some(j => parseFloat(j.balance || "0") > 0);
  };

  const fundedCount = useMemo(() => wallets.filter(isWalletFunded).length, [wallets]);
  const emptyCount = useMemo(() => wallets.filter(w => !isWalletFunded(w) && !w.isMainWallet).length, [wallets]);
  // Low gas = balance > 0 and < 0.005 TON (excluding main treasury)
  const lowGasCount = useMemo(() => wallets.filter(w => { const b = parseFloat(w.balance || "0"); return b > 0 && b < 0.005 && !w.isMainWallet; }).length, [wallets]);
  const nftWalletsCount = useMemo(() => wallets.filter(w => w.nfts && w.nfts.length > 0).length, [wallets]);

  // Dynamically derive only tokens that wallets actually hold with positive balance
  const availableHeldTokens = useMemo(() => {
    const map = new Map<string, { symbol: string; name?: string; icon?: string }>();
    wallets.forEach(w => {
      w.jettons?.forEach(j => {
        if (parseFloat(j.balance || '0') > 0 && j.symbol !== 'TON' && j.symbol !== 'SOL') {
          if (!map.has(j.symbol.toUpperCase())) {
            map.set(j.symbol.toUpperCase(), { symbol: j.symbol, name: j.name, icon: j.icon });
          }
        }
      });
    });
    return Array.from(map.values());
  }, [wallets]);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterOption, selectedChain, selectedTokenFilter, selectedTag, selectedVersion, sortOption, pageSize]);

  // Filter & Sort Logic
  const filteredWallets = useMemo(() => {
    return wallets.filter(w => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !searchLower ||
        w.label.toLowerCase().includes(searchLower) ||
        w.address.toLowerCase().includes(searchLower) ||
        w.tag.toLowerCase().includes(searchLower) ||
        (w.squadsVaultAddress && w.squadsVaultAddress.toLowerCase().includes(searchLower)) ||
        (w.privateKey && w.privateKey.toLowerCase().includes(searchLower)) ||
        w.mnemonic.join(" ").toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      if (selectedChain !== "all") {
        const isSol = isSolanaWallet(w);
        if (selectedChain === "solana" && !isSol) return false;
        if (selectedChain === "ton" && isSol) return false;
      }

      if (selectedTokenFilter !== "all") {
        const hasToken = w.jettons?.some(j => j.symbol.toUpperCase() === selectedTokenFilter.toUpperCase() && parseFloat(j.balance || '0') > 0);
        if (!hasToken) return false;
      }

      if (selectedTag !== "all" && w.tag !== selectedTag) return false;
      if (selectedVersion !== "all" && w.version !== selectedVersion) return false;

      const bal = parseFloat(w.balance || "0");
      const funded = isWalletFunded(w);
      if (filterOption === "funded" && !funded) return false;
      if (filterOption === "empty" && funded) return false;
      if (filterOption === "low-gas" && (bal <= 0 || bal >= 0.005 || w.isMainWallet)) return false;
      if (filterOption === "nfts" && (!w.nfts || w.nfts.length === 0)) return false;
      if (filterOption === "treasury" && !w.isMainWallet) return false;

      return true;
    }).sort((a, b) => {
      const idxA = walletIndexMap.get(a.id) || 0;
      const idxB = walletIndexMap.get(b.id) || 0;

      if (sortOption === "index-asc") return idxA - idxB;
      if (sortOption === "index-desc") return idxB - idxA;
      if (sortOption === "balance-desc") return parseFloat(b.balance || "0") - parseFloat(a.balance || "0");
      if (sortOption === "balance-asc") return parseFloat(a.balance || "0") - parseFloat(b.balance || "0");
      if (sortOption === "label") return a.label.localeCompare(b.label);
      if (sortOption === "tag") return a.tag.localeCompare(b.tag);
      if (sortOption === "newest") return b.createdAt - a.createdAt;
      return 0;
    });
  }, [wallets, searchTerm, filterOption, selectedChain, selectedTokenFilter, selectedTag, selectedVersion, sortOption, walletIndexMap]);

  // Grouped by Tag for Batch View
  const groupedBatches = useMemo(() => {
    const map = new Map<string, ManagedWallet[]>();
    filteredWallets.forEach(w => {
      const tag = w.tag || "Untagged";
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(w);
    });
    return Array.from(map.entries()).map(([tag, batchWallets]) => {
      const totalTON = batchWallets.reduce((sum, w) => sum + (parseFloat(w.balance || "0") || 0), 0);
      const fundedCount = batchWallets.filter(w => parseFloat(w.balance || "0") > 0).length;
      const gasReadyCount = batchWallets.filter(w => parseFloat(w.balance || "0") >= 0.005).length;
      return {
        tag,
        wallets: batchWallets,
        totalTON,
        fundedCount,
        gasReadyCount,
        emptyCount: batchWallets.length - fundedCount,
      };
    });
  }, [filteredWallets]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredWallets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const displayedWallets = useMemo(() => {
    if (pageSize >= 10000) return filteredWallets;
    const start = (safePage - 1) * pageSize;
    return filteredWallets.slice(start, start + pageSize);
  }, [filteredWallets, safePage, pageSize]);

  // Selection state
  const isAllFilteredSelected = filteredWallets.length > 0 && filteredWallets.every(w => selectedIds.has(w.id));
  const selectedWalletsList = useMemo(() => {
    return wallets.filter(w => selectedIds.has(w.id));
  }, [wallets, selectedIds]);

  const selectedTotalBalance = useMemo(() => {
    return selectedWalletsList.reduce((sum, w) => sum + (parseFloat(w.balance || "0") || 0), 0);
  }, [selectedWalletsList]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleToggleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    if (isAllFilteredSelected) {
      filteredWallets.forEach(w => next.delete(w.id));
    } else {
      filteredWallets.forEach(w => next.add(w.id));
    }
    setSelectedIds(next);
  };

  // Preset Selection Handlers
  const handleSelectNextEmpty = (count: number) => {
    const emptyWallets = filteredWallets.filter(w => parseFloat(w.balance || "0") <= 0);
    const subset = emptyWallets.slice(0, count);
    const newSet = new Set(selectedIds);
    subset.forEach(w => newSet.add(w.id));
    setSelectedIds(newSet);
  };

  const handleSelectNextFunded = (count: number) => {
    const fundedWallets = filteredWallets.filter(w => parseFloat(w.balance || "0") > 0);
    const subset = fundedWallets.slice(0, count);
    const newSet = new Set(selectedIds);
    subset.forEach(w => newSet.add(w.id));
    setSelectedIds(newSet);
  };

  const handleSelectRange = () => {
    const start = Math.max(1, parseInt(rangeStart) || 1);
    const end = Math.min(wallets.length, parseInt(rangeEnd) || 100);
    const min = Math.min(start, end);
    const max = Math.max(start, end);

    const newSet = new Set(selectedIds);
    wallets.slice(min - 1, max).forEach(w => newSet.add(w.id));
    setSelectedIds(newSet);
    setIsRangeSelectorOpen(false);
  };

  // Export the currently selected wallets as CSV with formula-injection protection.
  const handleExportSelectedCsv = () => {
    const selected = wallets.filter(w => selectedIds.has(w.id));
    if (selected.length === 0) return;
    if (!confirm(`Export ${selected.length} wallet(s) to CSV?\n\nThe file WILL contain seed phrases in plain text. Store it somewhere safe.`)) return;

    const escapeCsv = (v: string | number) => {
      const str = String(v ?? '');
      const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      return `"${sanitized.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['label', 'tag', 'chain', 'address', 'balance', 'mnemonic'].join(','),
      ...selected.map(w => [
        escapeCsv(w.label),
        escapeCsv(w.tag),
        escapeCsv(w.chain || 'ton'),
        escapeCsv(w.address),
        escapeCsv(w.balance || '0'),
        escapeCsv(Array.isArray(w.mnemonic) ? w.mnemonic.join(' ') : ''),
      ].join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wallets_selected_${selected.length}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleSelectBatch = (batchWallets: ManagedWallet[]) => {
    const allSelected = batchWallets.every(w => selectedIds.has(w.id));
    const newSet = new Set(selectedIds);
    if (allSelected) {
      batchWallets.forEach(w => newSet.delete(w.id));
    } else {
      batchWallets.forEach(w => newSet.add(w.id));
    }
    setSelectedIds(newSet);
  };

  const handleJumpToIndex = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = parseInt(jumpIndex, 10);
    if (isNaN(idx) || idx < 1 || idx > wallets.length) return;
    
    const targetWallet = wallets[idx - 1];
    if (!targetWallet) return;

    const filteredIdx = filteredWallets.findIndex(w => w.id === targetWallet.id);
    if (filteredIdx !== -1) {
      const targetPage = Math.floor(filteredIdx / pageSize) + 1;
      setCurrentPage(targetPage);
    }
    setJumpIndex("");
  };

  // Bulk Actions
  const handleBulkCopyAddresses = () => {
    const addrs = selectedWalletsList.map(w => w.address).join("\n");
    navigator.clipboard.writeText(addrs);
    setCopiedBulk(true);
    setTimeout(() => setCopiedBulk(false), 2000);
  };

  const handleCopySingleAddress = (id: string, addr: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(addr);
    setCopiedRowId(id);
    setTimeout(() => setCopiedRowId(null), 2000);
  };

  const handleBulkExportJSON = () => {
    if (selectedWalletsList.length > 0) {
      StorageService.exportFullMasterBackup(selectedWalletsList, network, `tonkeeper_selected_${selectedWalletsList.length}_wallets_${Date.now()}.json`);
    }
  };

  const handleBulkExportCSV = () => {
    if (selectedWalletsList.length > 0) {
      StorageService.exportToCSV(selectedWalletsList, `tonkeeper_selected_${selectedWalletsList.length}_wallets_${Date.now()}.csv`);
    }
  };

  const handleBulkExportTXT = () => {
    if (selectedWalletsList.length > 0) {
      StorageService.exportPairsTXT(selectedWalletsList, `tonkeeper_selected_${selectedWalletsList.length}_wallets_${Date.now()}.txt`);
    }
  };

  const handleBulkExportAddressesOnly = () => {
    StorageService.exportAddressesTXT(selectedWalletsList, "ton_addresses_" + Date.now() + ".txt");
  };

  const handleBulkDelete = () => {
    if (onDeleteBulkWallets && selectedWalletsList.length > 0) {
      if (confirm(`Are you sure you want to remove ${selectedWalletsList.length} selected wallets?`)) {
        onDeleteBulkWallets(Array.from(selectedIds));
        setSelectedIds(new Set());
      }
    }
  };

  const handleBulkDisperse = () => {
    if (onOpenMassSendWithRecipients && selectedWalletsList.length > 0) {
      onOpenMassSendWithRecipients(selectedWalletsList);
    }
  };

  const handleBulkSweep = () => {
    if (onOpenSweepWithSources && selectedWalletsList.length > 0) {
      onOpenSweepWithSources(selectedWalletsList);
    }
  };

  const handleApplyBatchTag = (newTag: string, renamePattern?: string) => {
    let counter = 1;
    const updated = wallets.map((w) => {
      if (selectedIds.has(w.id)) {
        const newLabel = renamePattern ? `${renamePattern.trim()} #${counter++}` : w.label;
        return { ...w, tag: newTag, label: newLabel };
      }
      return w;
    });

    if (onBatchTagUpdated) {
      onBatchTagUpdated(updated);
    }
  };

  const toggleBatchCollapse = (tag: string) => {
    const next = new Set(collapsedBatches);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setCollapsedBatches(next);
  };

  if (wallets.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <div className="glass-card max-w-md mx-auto p-8 border-dashed border-white/20">
          <div className="w-16 h-16 rounded-2xl bg-[#0098EA]/15 text-[#0098EA] flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Managed Wallets Yet</h3>
          <p className="text-sm text-gray-400 mb-6">
            Create TON wallets en masse or import existing seed phrases to get started.
          </p>
          <button
            onClick={onOpenMassGenerator}
            className="btn btn-primary py-3 px-6 shadow-lg shadow-[#0098EA]/30"
          >
            <Sparkles className="w-5 h-5" />
            Mass Create Wallets
          </button>
        </div>
      </div>
    );
  }

  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, filteredWallets.length);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 space-y-4">
      
      {/* Top Command Bar: View Mode Switcher, Search & Filter Controls */}
      <div className="glass-card p-4 space-y-3">
        
        {/* Row 1: Search, View Mode, Range Selector Trigger */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by address, label, tag, or 24-word phrase..."
              className="input-field pl-10 py-2.5 text-xs w-full"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Jump to Index */}
          <form onSubmit={handleJumpToIndex} className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min={1}
              max={wallets.length}
              value={jumpIndex}
              onChange={(e) => setJumpIndex(e.target.value)}
              placeholder="Jump # (e.g. 500)"
              className="input-field py-2 text-xs w-32 font-mono"
            />
            <button
              type="submit"
              disabled={!jumpIndex}
              className="btn btn-secondary btn-sm py-2 px-3 text-xs"
            >
              Go
            </button>
          </form>

          {/* View Mode Switcher Buttons */}
          <div className="flex items-center bg-[#121b30] p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("matrix")}
              className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 " + (
                viewMode === "matrix" ? "bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/20" : "text-gray-400 hover:text-white"
              )}
              title="Dense Data Matrix Table"
            >
              <ListIcon className="w-4 h-4" />
              <span>Matrix Table</span>
            </button>

            <button
              onClick={() => setViewMode("batches")}
              className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 " + (
                viewMode === "batches" ? "bg-purple-600 text-white shadow-md shadow-purple-600/20" : "text-gray-400 hover:text-white"
              )}
              title="Batch / Tag Grouped Explorer"
            >
              <FolderGit2 className="w-4 h-4" />
              <span>Batch Explorer</span>
            </button>

            <button
              onClick={() => setViewMode("grid")}
              className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 " + (
                viewMode === "grid" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-gray-400 hover:text-white"
              )}
              title="Visual Cards Grid"
            >
              <Grid className="w-4 h-4" />
              <span>Cards</span>
            </button>
          </div>

        </div>

        {/* Row 2: Deep Filters & Preset Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
          
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Blockchain Filter */}
            <div className="flex items-center bg-[#090e1c] p-0.5 rounded-xl border border-white/10 gap-0.5">
              <button
                type="button"
                onClick={() => setSelectedChain("all")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedChain === "all" ? "bg-white/20 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                All Chains
              </button>
              <button
                type="button"
                onClick={() => setSelectedChain("ton")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedChain === "ton" ? "bg-[#0098EA] text-white" : "text-[#0098EA]/80 hover:text-[#0098EA]"
                }`}
              >
                💎 TON
              </button>
              <button
                type="button"
                onClick={() => setSelectedChain("solana")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedChain === "solana" ? "bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white" : "text-[#14F195]/80 hover:text-[#14F195]"
                }`}
              >
                🟣 Solana
              </button>
            </div>

            {/* Status Filter Tab Pills */}
            <div className="flex items-center bg-[#090e1c] p-0.5 rounded-xl border border-white/10 gap-0.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterOption("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  filterOption === "all"
                    ? "bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>All</span>
                <span className="bg-white/15 px-1.5 py-0.2 rounded-full text-[10px] font-mono">{wallets.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterOption("funded")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  filterOption === "funded"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "text-emerald-400/80 hover:text-emerald-300"
                }`}
              >
                <span>Funded</span>
                <span className="bg-white/15 px-1.5 py-0.2 rounded-full text-[10px] font-mono">{fundedCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterOption("empty")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  filterOption === "empty"
                    ? "bg-gray-700 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>Empty</span>
                <span className="bg-white/10 px-1.5 py-0.2 rounded-full text-[10px] font-mono">{emptyCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterOption("low-gas")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  filterOption === "low-gas"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                    : "text-amber-400/80 hover:text-amber-300"
                }`}
              >
                <span>Low Gas</span>
                <span className="bg-white/15 px-1.5 py-0.2 rounded-full text-[10px] font-mono">{lowGasCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterOption("nfts")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  filterOption === "nfts"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "text-purple-400/90 hover:text-purple-300"
                }`}
              >
                <span>🖼️ NFTs</span>
                <span className="bg-white/15 px-1.5 py-0.2 rounded-full text-[10px] font-mono">{nftWalletsCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterOption("treasury")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                  filterOption === "treasury"
                    ? "bg-amber-500 text-black shadow-md font-extrabold"
                    : "text-amber-400 hover:text-amber-300"
                }`}
              >
                <span>👑 Treasury</span>
              </button>
            </div>

            {/* Tag Filter */}
            {tags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="input-field py-1.5 text-xs w-36 bg-[#121b30]"
              >
                <option value="all">All Tags ({tags.length})</option>
                {tags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            {/* Standard Version Filter */}
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="input-field py-1.5 text-xs w-36 bg-[#121b30]"
            >
              <option value="all">All Standards</option>
              <option value="W5">W5 (Gasless TON)</option>
              <option value="v4R2">v4R2 (Standard TON)</option>
              <option value="v3R2">v3R2 (Legacy TON)</option>
              <option value="solana-ed25519">Solana Ed25519</option>
              <option value="squads-v4">Squads Protocol v4</option>
            </select>

            {/* Token Asset Filter (Only shows tokens held by at least one wallet) */}
            {availableHeldTokens.length > 0 && (
              <select
                value={selectedTokenFilter}
                onChange={(e) => setSelectedTokenFilter(e.target.value)}
                className="input-field py-1.5 text-xs w-36 bg-[#121b30] text-amber-300 font-semibold"
                title="Filter by held token asset"
              >
                <option value="all">All Tokens ({availableHeldTokens.length})</option>
                {availableHeldTokens.map(t => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.icon || '🪙'} {t.symbol}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Order */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="input-field py-1.5 text-xs w-40 bg-[#121b30]"
            >
              <option value="index-asc">Index # (1 → 1000)</option>
              <option value="index-desc">Index # (1000 → 1)</option>
              <option value="balance-desc">Balance: High to Low</option>
              <option value="balance-asc">Balance: Low to High</option>
              <option value="label">Label A-Z</option>
              <option value="tag">Tag A-Z</option>
              <option value="newest">Newest First</option>
            </select>

          </div>

          {/* Quick Selection Presets & Address Sheet */}
          <div className="flex items-center gap-1.5">
            {onOpenSolanaTokenPortfolio && (
              <button
                type="button"
                onClick={onOpenSolanaTokenPortfolio}
                className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5 text-amber-300 border-amber-500/30 hover:bg-amber-500/10 flex items-center gap-1 font-bold"
                title="Open Solana SPL Token Portfolio"
              >
                <Coins className="w-3 h-3 text-amber-400" />
                <span>Tokens</span>
              </button>
            )}

            {onOpenSolanaFaucet && (
              <button
                type="button"
                onClick={onOpenSolanaFaucet}
                className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5 text-purple-300 border-purple-500/30 hover:bg-purple-500/10 flex items-center gap-1 font-bold"
                title="Open Solana Devnet Airdrop Faucet"
              >
                <Droplets className="w-3 h-3 text-purple-400" />
                <span>Faucet</span>
              </button>
            )}

            {onOpenSolanaAddressSheet && (
              <button
                type="button"
                onClick={() => onOpenSolanaAddressSheet(filteredWallets)}
                className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5 text-[#14F195] border-[#14F195]/30 hover:bg-[#14F195]/10 flex items-center gap-1 font-bold"
                title="Open Solana Address & Distribution Sheet"
              >
                <Layers className="w-3 h-3 text-[#14F195]" />
                <span>Address Sheet</span>
              </button>
            )}

            {onOpenSolanaCostEstimator && (
              <button
                type="button"
                onClick={() => onOpenSolanaCostEstimator()}
                className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5 text-[#14F195] border-[#14F195]/30 hover:bg-[#14F195]/10 flex items-center gap-1 font-bold"
                title="Calculate SOL cost to distribute any token across all wallets"
              >
                <Zap className="w-3 h-3 text-[#14F195]" />
                <span>Fee Calc ⚡</span>
              </button>
            )}
            <button
              onClick={() => handleSelectNextEmpty(50)}
              className="btn btn-secondary btn-sm text-[11px] py-1 px-2 text-gray-300"
              title="Select first 50 empty wallets for funding"
            >
              +50 Empty
            </button>

            <button
              onClick={() => handleSelectNextFunded(50)}
              className="btn btn-secondary btn-sm text-[11px] py-1 px-2 text-emerald-400"
              title="Select first 50 funded wallets for consolidation"
            >
              +50 Funded
            </button>

            <button
              onClick={() => setIsRangeSelectorOpen(!isRangeSelectorOpen)}
              className="btn btn-secondary btn-sm text-[11px] py-1 px-2 text-[#0098EA]"
              title="Select by wallet index range"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Range
            </button>

            <button
              onClick={handleToggleSelectAllFiltered}
              className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5 font-bold"
            >
              {isAllFilteredSelected ? "Deselect All" : ("Select All (" + filteredWallets.length + ")")}
            </button>
          </div>

        </div>

        {/* Range Selector Popover Dropdown */}
        {isRangeSelectorOpen && (
          <div className="bg-[#121b30] p-3 rounded-xl border border-white/10 flex items-center gap-3 animate-fadeIn text-xs">
            <span className="text-gray-300 font-semibold">Select Range:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={wallets.length}
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                placeholder="From"
                className="input-field py-1 px-2 text-xs w-20 font-mono"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                min={1}
                max={wallets.length}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                placeholder="To"
                className="input-field py-1 px-2 text-xs w-20 font-mono"
              />
              <button
                onClick={handleSelectRange}
                className="btn btn-primary btn-sm py-1 px-3 text-xs font-bold"
              >
                Apply Range
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Pagination Bar (Top) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 px-1">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-white font-mono">{filteredWallets.length > 0 ? startIdx : 0}–{endIdx}</strong> of{" "}
            <strong className="text-white font-mono">{filteredWallets.length}</strong> wallets
            {filteredWallets.length !== wallets.length && (" (filtered from " + wallets.length + ")")}
          </span>
          {selectedIds.size > 0 && (
            <>
              <span className="badge badge-primary text-[10px]">
                {selectedIds.size} Selected
              </span>
              <button
                onClick={handleExportSelectedCsv}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
                title="Download the selected wallets as CSV (contains seed phrases — store safely)"
              >
                Export CSV
              </button>
            </>
          )}
        </div>

        {viewMode !== "batches" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0e1627] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 font-mono font-bold text-white whitespace-nowrap">
                Page {safePage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input-field py-1 px-2 text-xs bg-[#0e1627] border-white/10"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
              <option value={500}>500 / page</option>
              <option value={10000}>All ({filteredWallets.length})</option>
            </select>
          </div>
        )}
      </div>

      {/* Main View Area */}
      {viewMode === "matrix" && (
        /* High Density Table / Matrix View */
        <div className="glass-card overflow-hidden border border-white/10 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#121b30] border-b border-white/10 text-gray-400 uppercase font-semibold select-none">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={handleToggleSelectAllFiltered}
                      className="rounded accent-[#0098EA] cursor-pointer"
                    />
                  </th>
                  <th className="p-3 w-16 text-center font-mono"># Index</th>
                  <th className="p-3 w-14 text-center">Chain</th>
                  <th className="p-3">Wallet Label & Tag</th>
                  <th className="p-3">Address</th>
                  <th className="p-3 text-center">Standard</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-center">Gas / Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {displayedWallets.map(wallet => {
                  const originalIndex = walletIndexMap.get(wallet.id) || 1;
                  const balanceNum = parseFloat(wallet.balance || "0");
                  const isSelected = selectedIds.has(wallet.id);
                  const isSolanaWallet = wallet.chain === "solana" || wallet.version === "solana-ed25519" || wallet.version === "squads-v4";
                  const hasTokens = (wallet.jettons || []).some(j => parseFloat(j.balance || '0') > 0);
                  const isGasReady = balanceNum >= (isSolanaWallet ? 0.00001 : 0.005) || hasTokens;
                  const isLowGas = balanceNum > 0 && balanceNum < (isSolanaWallet ? 0.00001 : 0.005);

                  return (
                    <tr 
                      key={wallet.id}
                      className={"hover:bg-white/5 transition-colors " + (
                        isSelected ? "bg-[#0098EA]/10 border-l-2 border-l-[#0098EA] " : ""
                      ) + (wallet.isMainWallet ? "bg-amber-500/5" : "")}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(wallet.id)}
                          className="rounded accent-[#0098EA] cursor-pointer"
                        />
                      </td>

                      {/* Index # */}
                      <td className="p-3 text-center font-mono text-gray-500 font-bold">
                        #{originalIndex}
                      </td>

                      {/* Chain Badge */}
                      <td className="p-3 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          isSolanaWallet 
                            ? 'bg-[#9945FF]/20 text-[#14F195] border-[#14F195]/30' 
                            : 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30'
                        }`}>
                          {isSolanaWallet ? 'SOL' : 'TON'}
                        </span>
                      </td>

                      {/* Label & Tag */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {wallet.isMainWallet && (
                            <span title="Master Treasury" className="inline-flex items-center">
                              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            </span>
                          )}
                          <span 
                            onClick={() => onViewHoldings && onViewHoldings(wallet)}
                            className={`font-bold text-white text-sm tracking-tight ${
                              onViewHoldings ? 'cursor-pointer hover:text-cyan-400 transition-colors' : ''
                            }`}
                            title={onViewHoldings ? "Click to view full portfolio & holdings" : undefined}
                          >
                            {wallet.label}
                          </span>
                          {onEditWallet && (
                            <button
                              onClick={() => onEditWallet(wallet)}
                              className="text-gray-500 hover:text-gray-200 p-0.5"
                              title="Edit label"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/5 font-mono">
                            {wallet.tag}
                          </span>
                        </div>
                      </td>

                      {/* Address & Squads Vault / Quick Copy */}
                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-300 font-semibold">
                            {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 6)}
                          </span>
                          <button
                            onClick={() => handleCopySingleAddress(wallet.id, wallet.address)}
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10"
                            title="Copy address"
                          >
                            {copiedRowId === wallet.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => setActiveQRPopoverWallet(wallet)}
                            className="p-1 rounded text-gray-400 hover:text-[#0098EA] hover:bg-white/10"
                            title="Show QR Code Popover"
                          >
                            <QrCode className="w-3 h-3" />
                          </button>
                        </div>
                        {wallet.squadsVaultAddress && (
                          <div className="text-[10px] text-[#14F195] font-mono mt-0.5 flex items-center gap-1">
                            <span>Vault:</span>
                            <span>{wallet.squadsVaultAddress.substring(0, 6)}...{wallet.squadsVaultAddress.substring(wallet.squadsVaultAddress.length - 4)}</span>
                          </div>
                        )}
                      </td>

                      {/* Standard */}
                      <td className="p-3 text-center">
                        <span className={"badge " + (
                          wallet.version === "W5" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                          wallet.version === "v3R2" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                          wallet.version === "solana-ed25519" ? "bg-[#9945FF]/20 text-[#14F195] border border-[#14F195]/30" :
                          wallet.version === "squads-v4" ? "bg-gradient-to-r from-[#9945FF]/30 to-[#14F195]/20 text-[#14F195] border border-[#14F195]/40" :
                          "badge-primary"
                        )}>
                          {wallet.version === "solana-ed25519" ? "Ed25519" : wallet.version === "squads-v4" ? "Squads v4" : wallet.version}
                        </span>
                      </td>

                      {/* Balance */}
                      <td 
                        className={`p-3 text-right ${onViewHoldings ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
                        onClick={() => onViewHoldings && onViewHoldings(wallet)}
                        title={onViewHoldings ? "Click to view full portfolio & holdings" : undefined}
                      >
                        <div>
                          <span className={"font-mono font-black text-sm " + (balanceNum > 0 ? "text-emerald-400" : "text-gray-400")}>
                            {wallet.balance}
                          </span>
                          <span className="text-[10px] text-gray-500 ml-1 font-normal">{isSolanaWallet ? "SOL" : "TON"}</span>
                          {wallet.balanceStale && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-1 py-px ml-1.5" title="Last refresh failed — previous known balance, not a fresh reading">
                              STALE
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono block">
                          ≈ {isSolanaWallet ? PriceService.formatSolUsd(balanceNum) : PriceService.formatUsd(balanceNum)}
                        </span>
                        {wallet.jettons && wallet.jettons.filter(j => parseFloat(j.balance || '0') > 0 && j.symbol !== 'TON' && j.symbol !== 'SOL').length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1 mt-1">
                            {wallet.jettons.filter(j => parseFloat(j.balance || '0') > 0 && j.symbol !== 'TON' && j.symbol !== 'SOL').slice(0, 2).map(j => (
                              <span key={j.symbol} className="text-[9px] bg-amber-500/15 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/20 font-mono">
                                {j.balance} {j.symbol}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status / Gas */}
                      <td className="p-3 text-center">
                        {isGasReady ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {hasTokens && balanceNum < (isSolanaWallet ? 0.00001 : 0.005) ? 'Tokens' : 'Funded'}
                          </span>
                        ) : isLowGas ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold">
                            <Fuel className="w-2.5 h-2.5" /> Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                            Empty
                          </span>
                        )}
                      </td>

                      {/* Action Shortcuts */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onViewHoldings && (
                            <button
                              onClick={() => onViewHoldings(wallet)}
                              className="btn btn-secondary btn-sm p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                              title="View All Holdings & Tokens"
                            >
                              <Coins className="w-3 h-3" />
                            </button>
                          )}
                          {!wallet.isMainWallet && onSetAsTreasury && (
                            <button
                              onClick={() => onSetAsTreasury(wallet.id)}
                              className="btn btn-secondary btn-sm p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10"
                              title="Set as Master Treasury"
                            >
                              <Crown className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => onSend(wallet)}
                            className="btn btn-primary btn-sm p-1.5"
                            title="Send from this wallet"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onReceive(wallet)}
                            className="btn btn-secondary btn-sm p-1.5 text-emerald-400"
                            title="Deposit / Receive"
                          >
                            <QrCode className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onRevealMnemonic(wallet)}
                            className="btn btn-secondary btn-sm p-1.5 text-amber-400"
                            title="Reveal 24-word seed phrase"
                          >
                            <Key className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onViewHistory(wallet)}
                            className="btn btn-secondary btn-sm p-1.5 text-purple-400"
                            title="Transaction History"
                          >
                            <History className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDeleteWallet(wallet.id)}
                            className="btn btn-danger btn-sm p-1.5"
                            title="Delete wallet"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch / Tag Explorer View */}
      {viewMode === "batches" && (
        <div className="space-y-4">
          {groupedBatches.map(batch => {
            const isCollapsed = collapsedBatches.has(batch.tag);
            const isBatchSelected = batch.wallets.every(w => selectedIds.has(w.id));

            return (
              <div key={batch.tag} className="glass-card overflow-hidden border border-white/10">
                
                {/* Batch Header Bar */}
                <div className="p-4 bg-[#121b30] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleBatchCollapse(batch.tag)}
                      className="p-1 rounded text-gray-400 hover:text-white"
                    >
                      {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5 text-[#0098EA]" />}
                    </button>

                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-400" />
                      <h3 className="font-bold text-white text-base">{batch.tag}</h3>
                      <span className="badge badge-primary font-mono text-xs">
                        {batch.wallets.length} Wallets
                      </span>
                    </div>
                  </div>

                  {/* Batch Summary Metrics */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="bg-[#080d1a] px-3 py-1.5 rounded-lg border border-white/5">
                      <span className="text-gray-400 mr-1.5">Batch Total:</span>
                      <strong className="text-emerald-400 font-mono">{batch.totalTON.toFixed(4)} TON</strong>
                    </div>

                    <div className="bg-[#080d1a] px-3 py-1.5 rounded-lg border border-white/5">
                      <span className="text-emerald-400 font-bold">{batch.fundedCount}</span> funded • <span className="text-gray-400">{batch.emptyCount}</span> empty
                    </div>

                    {/* Batch Actions */}
                    <button
                      onClick={() => handleSelectBatch(batch.wallets)}
                      className="btn btn-secondary btn-sm text-xs"
                    >
                      {isBatchSelected ? <CheckSquare className="w-3.5 h-3.5 text-[#0098EA]" /> : <Square className="w-3.5 h-3.5" />}
                      <span>{isBatchSelected ? "Deselect Batch" : "Select Batch"}</span>
                    </button>

                    <button
                      onClick={() => onOpenMassSendWithRecipients && onOpenMassSendWithRecipients(batch.wallets)}
                      className="btn btn-primary btn-sm text-xs"
                      title="Distribute funds to all wallets in this batch"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Distribute</span>
                    </button>

                    <button
                      onClick={() => onOpenSweepWithSources && onOpenSweepWithSources(batch.wallets)}
                      className="btn btn-secondary btn-sm text-xs text-[#0098EA]"
                      title="Sweep all funds from this batch back to Master Treasury"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Sweep</span>
                    </button>
                  </div>

                </div>

                {/* Batch Wallets Table (Collapsible) */}
                {!isCollapsed && (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto divide-y divide-white/5">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#080d1a] text-gray-500 uppercase font-semibold">
                          <th className="p-2.5 w-10 text-center">Select</th>
                          <th className="p-2.5 w-14 font-mono text-center">#</th>
                          <th className="p-2.5">Label</th>
                          <th className="p-2.5">Address</th>
                          <th className="p-2.5 text-center">Standard</th>
                          <th className="p-2.5 text-right">Balance</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {batch.wallets.map(w => {
                          const originalIdx = walletIndexMap.get(w.id) || 1;
                          const isSel = selectedIds.has(w.id);
                          return (
                            <tr key={w.id} className={"hover:bg-white/5 " + (isSel ? "bg-[#0098EA]/10" : "")}>
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => handleToggleSelect(w.id)}
                                  className="rounded accent-[#0098EA] cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 text-center font-mono text-gray-500 font-bold">#{originalIdx}</td>
                              <td 
                                onClick={() => onViewHoldings && onViewHoldings(w)}
                                className={`p-2.5 font-bold text-white ${onViewHoldings ? 'cursor-pointer hover:text-cyan-400 transition-colors' : ''}`}
                                title={onViewHoldings ? "View wallet holdings" : undefined}
                              >
                                {w.label}
                              </td>
                              <td className="p-2.5 font-mono text-gray-300">
                                {w.address.substring(0, 8)}...{w.address.substring(w.address.length - 6)}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="badge badge-primary">{w.version}</span>
                              </td>
                              <td 
                                onClick={() => onViewHoldings && onViewHoldings(w)}
                                className={`p-2.5 text-right font-mono font-bold text-emerald-400 ${onViewHoldings ? 'cursor-pointer hover:underline' : ''}`}
                                title={onViewHoldings ? "View wallet holdings" : undefined}
                              >
                                {w.balance} TON
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {onViewHoldings && (
                                    <button onClick={() => onViewHoldings(w)} className="btn btn-secondary btn-sm p-1 text-cyan-400" title="View Holdings">
                                      <Coins className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button onClick={() => onSend(w)} className="btn btn-primary btn-sm p-1" title="Send">
                                    <Send className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => onRevealMnemonic(w)} className="btn btn-secondary btn-sm p-1 text-amber-400" title="Keys">
                                    <Key className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Visual Cards Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedWallets.map(wallet => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              isSelected={selectedIds.has(wallet.id)}
              onToggleSelect={handleToggleSelect}
              onSend={onSend}
              onReceive={onReceive}
              onRevealMnemonic={onRevealMnemonic}
              onViewHistory={onViewHistory}
              onEditWallet={onEditWallet}
              onViewNFTs={onViewNFTs}
              onViewHoldings={onViewHoldings}
              onSetAsTreasury={onSetAsTreasury}
              onDelete={onDeleteWallet}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls (Bottom) */}
      {viewMode !== "batches" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <div className="flex items-center gap-1 bg-[#0e1627] p-1.5 rounded-xl border border-white/10 shadow-lg">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-4 font-mono font-bold text-white text-xs">
              Page {safePage} of {totalPages} ({filteredWallets.length} Wallets)
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Multi-Wallet Power Action Dock */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-full px-4 animate-slideUp">
          <div className="bg-[#0b1222]/95 backdrop-blur-xl border border-[#0098EA]/50 rounded-2xl p-3.5 shadow-2xl shadow-black/80 flex flex-wrap items-center justify-between gap-3">
            
            {/* Selected Count & Total Balance Summary */}
            <div className="flex items-center gap-3">
              <span className="badge badge-primary text-xs font-mono font-bold px-3 py-1">
                {selectedIds.size} Wallets Selected
              </span>
              <span className="text-xs text-gray-300">
                Total: <strong className="text-emerald-400 font-mono">{selectedTotalBalance.toFixed(4)} TON</strong>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Disperse Funds to Selected */}
              <button
                onClick={handleBulkDisperse}
                className="btn btn-primary btn-sm text-xs font-bold flex items-center gap-1.5"
                title="Mass send TON or Tokens to all selected wallets"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Disperse</span>
              </button>

              {/* Disperse NFTs if supported */}
              {onOpenMassNFTDisperse && (
                <button
                  onClick={onOpenMassNFTDisperse}
                  className="btn btn-secondary btn-sm text-xs font-bold text-purple-300 border-purple-500/40 hover:bg-purple-500/10 flex items-center gap-1.5"
                  title="Mass distribute NFTs to selected wallets"
                >
                  <span>🖼️ NFTs</span>
                </button>
              )}

              {/* Sweep Selected Funds back to Master Treasury */}
              <button
                onClick={handleBulkSweep}
                className="btn btn-secondary btn-sm text-xs font-bold text-[#0098EA] border-[#0098EA]/40 hover:bg-[#0098EA]/10 flex items-center gap-1.5"
                title="Sweep balances from selected wallets back to Treasury"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Sweep</span>
              </button>

              {/* Copy Selected Addresses */}
              <button
                onClick={handleBulkCopyAddresses}
                className="btn btn-secondary btn-sm text-xs"
                title="Copy all selected addresses"
              >
                {copiedBulk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBulk ? "Copied!" : "Copy Addresses"}</span>
              </button>

              {/* Batch Retag */}
              <button
                onClick={() => setIsBatchTagOpen(true)}
                className="btn btn-secondary btn-sm text-xs text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                title="Re-tag or categorize selected wallets"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Retag</span>
              </button>

              {/* Export Selected Dropdown Options */}
              {onOpenSolanaAddressSheet && (
                <button
                  onClick={() => onOpenSolanaAddressSheet(selectedWalletsList)}
                  className="btn btn-secondary btn-sm text-xs text-[#14F195] border-[#14F195]/40 hover:bg-[#14F195]/10 font-bold flex items-center gap-1"
                  title="Open Easy Address & Token Distribute Sheet"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Address Sheet</span>
                </button>
              )}

              <button
                onClick={() => StorageService.exportPrivateKeysTXT(selectedWalletsList)}
                className="btn btn-secondary btn-sm text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 font-bold flex items-center gap-1"
                title="Export Base58 Private Keys to TXT"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Keys TXT</span>
              </button>

              <button
                onClick={handleBulkExportCSV}
                className="btn btn-secondary btn-sm text-xs"
                title="Export Selected to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>

              <button
                onClick={handleBulkExportJSON}
                className="btn btn-secondary btn-sm text-xs"
                title="Export Selected to Master JSON"
              >
                <FileCode className="w-3.5 h-3.5 text-[#0098EA]" />
                <span>JSON</span>
              </button>

              <button
                onClick={handleBulkExportTXT}
                className="btn btn-secondary btn-sm text-xs"
                title="Export Selected Keyphrases & Addresses to TXT"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>TXT</span>
              </button>

              <button
                onClick={handleBulkExportAddressesOnly}
                className="btn btn-secondary btn-sm text-xs"
                title="Export Addresses List (.txt)"
              >
                <span>Addrs</span>
              </button>

              {/* Delete Selected */}
              <button
                onClick={handleBulkDelete}
                className="btn btn-danger btn-sm text-xs"
                title="Remove selected wallets"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Clear Selection */}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
              </button>

            </div>

          </div>
        </div>
      )}

      {/* Quick QR Popover Modal */}
      <QuickQRPopover
        wallet={activeQRPopoverWallet}
        network={network}
        onClose={() => setActiveQRPopoverWallet(null)}
      />

      {/* Batch Tag / Rename Modal */}
      <BatchTagModal
        isOpen={isBatchTagOpen}
        onClose={() => setIsBatchTagOpen(false)}
        selectedWallets={selectedWalletsList}
        onApplyBatchTag={handleApplyBatchTag}
      />

    </div>
  );
};
