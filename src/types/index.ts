export type BlockchainType = 'ton' | 'solana';

export type WalletVersion = 'v4R2' | 'v3R2' | 'W5' | 'solana-ed25519' | 'squads-v4';

export type Network = 'mainnet' | 'testnet';

export interface JettonBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  jettonAddress: string;
  icon?: string;
  usdValue?: string;
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTItem {
  id: string;
  address: string;          // NFT Item contract address
  name: string;
  description?: string;
  image: string;            // Image URL or data URI
  previewImage?: string;
  collectionName?: string;
  collectionAddress?: string;
  ownerAddress: string;     // Current owner wallet address
  index?: number;
  attributes?: NFTAttribute[];
  verified?: boolean;
  addedAt?: number;
}

export interface NetworkBalanceData {
  ton: string;
  tonNano: string;
  jettons: JettonBalance[];
  nfts?: NFTItem[];
}

export interface ManagedWallet {
  id: string;
  chain?: BlockchainType;   // 'ton' | 'solana' (default 'ton')
  label: string;
  tag: string;
  mnemonic: string[];
  publicKey: string;
  privateKey?: string;      // Base58 private key (for Solana)
  privateKeyHex?: string;   // Hex private key
  address: string;          // User-friendly non-bounceable or bounceable address (UQ... / EQ...) or Solana Base58 pubkey
  rawAddress: string;       // 0:... format for TON, Base58 for Solana
  version: WalletVersion;
  subwalletId: number;
  createdAt: number;
  balance: string;          // in TON or SOL for current active network view
  balanceNano: string;      // in nanoTON or lamports
  jettons?: JettonBalance[];// Array of Jetton token balances / SPL token balances
  nfts?: NFTItem[];         // Array of owned TON/Solana NFTs
  squadsVaultAddress?: string; // Squads Protocol v4 Vault PDA (index 0)
  squadsMultisigPda?: string;  // Squads Protocol v4 Multisig PDA
  squadsProgramId?: string;    // SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf
  networkBalances?: {
    mainnet?: NetworkBalanceData;
    testnet?: NetworkBalanceData;
  };
  lastChecked?: number;
  /** True when the last balance refresh failed and `balance` is the previous known value, not fresh. */
  balanceStale?: boolean;
  isCustomImport?: boolean;
  isMainWallet?: boolean;   // Designated Master Treasury Wallet
}

/**
 * Robustly determines if a wallet belongs to the Solana blockchain.
 * Checks chain flag, version (solana-ed25519 / squads-v4), or address format.
 */
export function isSolanaWallet(w?: Partial<ManagedWallet> | null): boolean {
  if (!w) return false;
  if (w.chain === 'solana') return true;
  if (w.version === 'solana-ed25519' || w.version === 'squads-v4') return true;
  if (w.address && !w.address.startsWith('EQ') && !w.address.startsWith('UQ') && !w.address.includes(':')) {
    return true;
  }
  return false;
}

export interface JettonTokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  masterAddress: string;
  icon: string;
  usdPrice: number;
}

export interface WalletBackupExport {
  version: string;
  exportedAt: string;
  network: Network;
  totalWallets: number;
  wallets: Array<{
    index: number;
    id: string;
    chain?: BlockchainType;
    label: string;
    tag: string;
    version: WalletVersion;
    subwalletId: number;
    address: string;
    rawAddress: string;
    publicKey: string;
    privateKey?: string;
    squadsVaultAddress?: string;
    mnemonic: string;
    createdAt: string;
    isMainWallet?: boolean;
  }>;
}

export interface Transaction {
  hash: string;
  type: 'in' | 'out';
  amount: string;           // in TON or Jetton
  tokenSymbol?: string;
  sender: string;
  recipient: string;
  comment?: string;
  timestamp: number;
  fee?: string;
  status: 'confirmed' | 'pending' | 'failed';
}

export interface BulkGeneratorConfig {
  count: number;
  version: WalletVersion;
  tagPrefix: string;
  subwalletId: number;
}

export interface MassSendItem {
  recipientAddress: string;
  recipientLabel?: string;
  amount: string;           // TON or Token amount
  comment?: string;
  status: 'idle' | 'pending' | 'success' | 'failed';
  txHash?: string;
  error?: string;
}

export interface MassNFTTransferItem {
  id: string;
  nft: NFTItem;
  fromWallet: ManagedWallet;
  recipientAddress: string;
  comment?: string;
  status: 'idle' | 'pending' | 'success' | 'failed';
  txHash?: string;
  error?: string;
}

export interface VaultConfig {
  isLocked: boolean;
  hasPin: boolean;
  pinHash?: string;      // PBKDF2 verifier (v2) or legacy SHA-256 (v1)
  pinSalt?: string;      // v2: random salt for the verifier KDF
  pinKdf?: 'pbkdf2-sha256';
  lastBackupAt?: number;
}

export interface WalletHealthScore {
  score: number;             // 0 to 100
  level: 'Excellent' | 'Good' | 'Fair' | 'Risk';
  issues: string[];
  recommendations: string[];
}
