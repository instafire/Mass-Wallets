import { Connection, PublicKey, Keypair, SystemProgram, Transaction as SolanaTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction,
  unpackAccount
} from '@solana/spl-token';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import * as squads from '@sqds/multisig';
import { PriceService } from './priceService';
import type { 
  ManagedWallet, 
  WalletVersion, 
  Network, 
  JettonBalance, 
  JettonTokenInfo 
} from '../types';

// Squads Protocol v4 Program ID (Verified Mainnet & Devnet)
export const SQUADS_V4_PROGRAM_ID = squads.PROGRAM_ID;

// Solana RPC endpoints helper: loopback proxy (/api/rpc/solana) and browser-friendly public nodes
export function getSolanaEndpoints(network: Network = 'mainnet'): string[] {
  if (network === 'testnet') {
    return [
      'https://api.devnet.solana.com',
      'https://api.testnet.solana.com',
    ];
  }
  const isBrowser = typeof window !== 'undefined' && typeof window.location !== 'undefined' && !!window.location?.origin;
  const list: string[] = [];
  if (isBrowser && window.location.protocol.startsWith('http')) {
    list.push(`${window.location.origin}/api/rpc/solana`);
  }
  list.push('https://solana-rpc.publicnode.com');
  list.push('https://api.mainnet-beta.solana.com');
  return list;
}

// Popular Solana SPL Tokens registry
export const SUPPORTED_SOLANA_TOKENS: JettonTokenInfo[] = [
  {
    symbol: 'SOL',
    name: 'Solana (Native)',
    decimals: 9,
    masterAddress: 'So11111111111111111111111111111111111111112',
    icon: '🟣',
    usdPrice: 154.20,
  },
  {
    symbol: 'MYA',
    name: 'askmya (pump.fun)',
    decimals: 6,
    masterAddress: 'AdgYuCBng63wg8NRAAep57wZF6ptTi9hHoFFTEzwpump',
    icon: '💊',
    usdPrice: 0.0000008,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Solana)',
    decimals: 6,
    masterAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    icon: '💵',
    usdPrice: 1.00,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD (Solana)',
    decimals: 6,
    masterAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    icon: '💲',
    usdPrice: 1.00,
  },
  {
    symbol: 'BONK',
    name: 'Bonk Token',
    decimals: 5,
    masterAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    icon: '🐶',
    usdPrice: 0.000021,
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    masterAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    icon: '🪐',
    usdPrice: 0.85,
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    masterAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    icon: '⚡',
    usdPrice: 1.75,
  },
  {
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    masterAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    icon: '🧢',
    usdPrice: 2.35,
  },
  {
    symbol: 'PYTH',
    name: 'Pyth Network',
    decimals: 6,
    masterAddress: 'HZ1JovNiPvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    icon: '🔮',
    usdPrice: 0.38,
  },
];

export class SolanaService {
  private static connectionCache: Map<Network, Connection> = new Map();

  /**
   * Get cached or create Connection for Solana network
   */
  public static getConnection(network: Network = 'mainnet'): Connection {
    if (!this.connectionCache.has(network)) {
      const endpoints = getSolanaEndpoints(network);
      const connection = new Connection(endpoints[0], 'confirmed');
      this.connectionCache.set(network, connection);
    }
    return this.connectionCache.get(network)!;
  }

  /**
   * Get alternate fallback Connection if primary fails
   */
  public static getFallbackConnection(network: Network = 'mainnet'): Connection {
    const endpoints = getSolanaEndpoints(network);
    const fallbackEndpoint = endpoints[1] || endpoints[0];
    return new Connection(fallbackEndpoint, 'confirmed');
  }

  /**
   * Validate a Solana public key address
   */
  public static isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    try {
      const pubkey = new PublicKey(address.trim());
      // Valid Base58 32-byte public key (handles both standard keypairs and PDAs like Squads vaults)
      return pubkey.toBytes().length === 32;
    } catch {
      return false;
    }
  }

  /**
   * Derive Squads Protocol v4 Multisig PDA and Vault PDA (Index 0)
   * Using official @sqds/multisig SDK methods
   */
  public static deriveSquadsV4Accounts(authorityPublicKey: PublicKey): {
    multisigPda: string;
    vaultPda: string;
    programId: string;
  } {
    try {
      const [multisigPda] = squads.getMultisigPda({
        createKey: authorityPublicKey,
        programId: SQUADS_V4_PROGRAM_ID,
      });

      const [vaultPda] = squads.getVaultPda({
        multisigPda,
        index: 0,
        programId: SQUADS_V4_PROGRAM_ID,
      });

      return {
        multisigPda: multisigPda.toBase58(),
        vaultPda: vaultPda.toBase58(),
        programId: SQUADS_V4_PROGRAM_ID.toBase58(),
      };
    } catch (e) {
      console.error('Error deriving Squads v4 PDAs:', e);
      return {
        multisigPda: '',
        vaultPda: '',
        programId: SQUADS_V4_PROGRAM_ID.toBase58(),
      };
    }
  }

  /**
   * Derive Solana Keypair from mnemonic seed using standard BIP44 derivation path: m/44'/501'/0'/0'
   */
  public static async deriveKeypairFromMnemonic(mnemonicWords: string[] | string): Promise<Keypair> {
    const words = Array.isArray(mnemonicWords) ? mnemonicWords.join(' ') : mnemonicWords;
    const seed = await bip39.mnemonicToSeed(words.trim());
    const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
    return Keypair.fromSeed(derived);
  }

  /**
   * Create a single Solana wallet (Standard Ed25519 or Squads Protocol v4 Vault)
   */
  public static async createWallet(
    version: WalletVersion = 'solana-ed25519',
    label: string = 'Solana Wallet',
    tag: string = 'Solana',
    mnemonicLength: 12 | 24 = 24
  ): Promise<ManagedWallet> {
    const strength = mnemonicLength === 12 ? 128 : 256;
    const mnemonicStr = bip39.generateMnemonic(strength);
    const mnemonicWords = mnemonicStr.split(' ');

    return await this.importWalletFromMnemonic(mnemonicWords, version, label, tag);
  }

  /**
   * Import wallet from 12 or 24-word seed phrase
   */
  public static async importWalletFromMnemonic(
    mnemonicInput: string[] | string,
    version: WalletVersion = 'solana-ed25519',
    label: string = 'Imported Solana Wallet',
    tag: string = 'Imported'
  ): Promise<ManagedWallet> {
    const rawWords = Array.isArray(mnemonicInput)
      ? mnemonicInput
      : mnemonicInput.trim().split(/\s+/);

    const words = rawWords.map(w => w.trim().toLowerCase()).filter(w => w.length > 0);

    if (words.length !== 12 && words.length !== 24) {
      throw new Error(`Invalid mnemonic phrase length (${words.length} words). Solana seed phrases must be 12 or 24 words.`);
    }

    const keypair = await this.deriveKeypairFromMnemonic(words);
    const pubkey = keypair.publicKey;
    const address = pubkey.toBase58();
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    const privateKeyHex = Buffer.from(keypair.secretKey).toString('hex');

    // Derive Squads Protocol v4 PDAs
    const squadsAccounts = this.deriveSquadsV4Accounts(pubkey);

    const defaultTokens: JettonBalance[] = [
      {
        symbol: 'MYA',
        name: 'askmya (pump.fun)',
        balance: '0.00',
        decimals: 6,
        jettonAddress: 'AdgYuCBng63wg8NRAAep57wZF6ptTi9hHoFFTEzwpump',
        icon: '💊',
        usdValue: '$0.00',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '0.00',
        decimals: 6,
        jettonAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        icon: '💵',
        usdValue: '$0.00',
      },
    ];

    return {
      id: `w_sol_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      chain: 'solana',
      label,
      tag,
      version: version === 'squads-v4' ? 'squads-v4' : 'solana-ed25519',
      subwalletId: 0,
      mnemonic: words,
      publicKey: address,
      privateKey: privateKeyBase58,
      privateKeyHex,
      address,
      rawAddress: address,
      squadsVaultAddress: squadsAccounts.vaultPda,
      squadsMultisigPda: squadsAccounts.multisigPda,
      squadsProgramId: squadsAccounts.programId,
      createdAt: Date.now(),
      balance: '0.00',
      balanceNano: '0',
      jettons: defaultTokens,
      networkBalances: {
        mainnet: { ton: '0.00', tonNano: '0', jettons: defaultTokens },
        testnet: { ton: '0.00', tonNano: '0', jettons: defaultTokens },
      },
    };
  }

  /**
   * Import Solana wallet from raw private key (Base58, JSON byte array, or Hex)
   */
  public static importWalletFromPrivateKey(
    privateKeyInput: string,
    version: WalletVersion = 'solana-ed25519',
    label: string = 'Imported Solana Wallet',
    tag: string = 'Imported'
  ): ManagedWallet {
    const cleanInput = privateKeyInput.trim();
    let secretKeyBytes: Uint8Array;

    // 1. JSON Array format: [12, 45, 98, ...]
    if (cleanInput.startsWith('[') && cleanInput.endsWith(']')) {
      try {
        const arr = JSON.parse(cleanInput);
        if (Array.isArray(arr) && (arr.length === 64 || arr.length === 32)) {
          secretKeyBytes = new Uint8Array(arr);
        } else {
          throw new Error('Invalid JSON keypair array length');
        }
      } catch (e: any) {
        throw new Error('Failed to parse JSON keypair array: ' + e?.message);
      }
    }
    // 2. Hex format
    else if (/^[0-9a-fA-F]{64}$/.test(cleanInput) || /^[0-9a-fA-F]{128}$/.test(cleanInput)) {
      secretKeyBytes = new Uint8Array(Buffer.from(cleanInput, 'hex'));
    }
    // 3. Base58 string (Standard Solana format: Phantom, Solflare, etc.)
    else {
      try {
        secretKeyBytes = bs58.decode(cleanInput);
      } catch (e: any) {
        throw new Error('Invalid Base58 private key: ' + e?.message);
      }
    }

    let keypair: Keypair;
    if (secretKeyBytes.length === 64) {
      keypair = Keypair.fromSecretKey(secretKeyBytes);
    } else if (secretKeyBytes.length === 32) {
      keypair = Keypair.fromSeed(secretKeyBytes);
    } else {
      throw new Error(`Invalid secret key byte length: ${secretKeyBytes.length}. Expected 32 or 64 bytes.`);
    }

    const pubkey = keypair.publicKey;
    const address = pubkey.toBase58();
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    const privateKeyHex = Buffer.from(keypair.secretKey).toString('hex');
    const squadsAccounts = this.deriveSquadsV4Accounts(pubkey);

    return {
      id: `w_sol_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      chain: 'solana',
      label,
      tag,
      version: version === 'squads-v4' ? 'squads-v4' : 'solana-ed25519',
      subwalletId: 0,
      mnemonic: [],
      publicKey: address,
      privateKey: privateKeyBase58,
      privateKeyHex,
      address,
      rawAddress: address,
      squadsVaultAddress: squadsAccounts.vaultPda,
      squadsMultisigPda: squadsAccounts.multisigPda,
      squadsProgramId: squadsAccounts.programId,
      createdAt: Date.now(),
      balance: '0.00',
      balanceNano: '0',
      jettons: [],
      isCustomImport: true,
      networkBalances: {
        mainnet: { ton: '0.00', tonNano: '0', jettons: [] },
        testnet: { ton: '0.00', tonNano: '0', jettons: [] },
      },
    };
  }

  /**
   * High-speed bulk Solana wallet generation with progress feedback and UI yielding
   */
  public static async generateBulkWallets(
    count: number,
    version: WalletVersion = 'solana-ed25519',
    tagPrefix: string = 'Solana-Batch',
    onProgress?: (current: number, total: number) => void
  ): Promise<ManagedWallet[]> {
    const wallets: ManagedWallet[] = [];
    const timestamp = Date.now();
    const safeCount = Math.max(1, Math.min(1000, count));

    for (let i = 0; i < safeCount; i++) {
      const label = `${tagPrefix} #${i + 1}`;
      const wallet = await this.createWallet(version, label, tagPrefix, 24);
      wallet.createdAt = timestamp + i;
      wallets.push(wallet);

      if (onProgress) {
        onProgress(i + 1, safeCount);
      }

      // Yield execution every 5 wallets to keep UI 60fps responsive
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return wallets;
  }

  /**
   * Fetch live SOL balance for a single address
   */
  public static async fetchBalance(
    addressStr: string,
    network: Network = 'mainnet'
  ): Promise<{ balance: string; balanceNano: string }> {
    try {
      const connection = this.getConnection(network);
      const pubkey = new PublicKey(addressStr);
      const lamports = await connection.getBalance(pubkey);
      const sol = lamports / LAMPORTS_PER_SOL;

      return {
        balance: sol.toFixed(4),
        balanceNano: lamports.toString(),
      };
    } catch (err) {
      console.warn(`Error fetching Solana balance for ${addressStr}:`, err);
      return { balance: '0.0000', balanceNano: '0' };
    }
  }

  /**
   * High-efficiency bulk balance query using getMultipleAccountsInfo (100 per chunk)
   */
  public static async fetchBalancesBulk(
    addresses: string[],
    network: Network = 'mainnet'
  ): Promise<Map<string, { balance: string; balanceNano: string }>> {
    const results = new Map<string, { balance: string; balanceNano: string }>();
    if (addresses.length === 0) return results;

    const connection = this.getConnection(network);
    const chunkSize = 100;

    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize);
      try {
        const publicKeys = chunk.map(a => new PublicKey(a));
        const accounts = await connection.getMultipleAccountsInfo(publicKeys);

        accounts.forEach((acc, idx) => {
          const addr = chunk[idx];
          const lamports = acc ? acc.lamports : 0;
          const sol = lamports / LAMPORTS_PER_SOL;
          results.set(addr, {
            balance: sol.toFixed(4),
            balanceNano: lamports.toString(),
          });
        });
      } catch (e) {
        try {
          const fallbackConn = this.getFallbackConnection(network);
          const publicKeys = chunk.map(a => new PublicKey(a));
          const accounts = await fallbackConn.getMultipleAccountsInfo(publicKeys);
          accounts.forEach((acc, idx) => {
            const addr = chunk[idx];
            const lamports = acc ? acc.lamports : 0;
            const sol = lamports / LAMPORTS_PER_SOL;
            results.set(addr, {
              balance: sol.toFixed(4),
              balanceNano: lamports.toString(),
            });
          });
        } catch (err2) {
          console.warn(`Error batch-fetching Solana balances chunk ${i}:`, err2);
        }
      }
    }

    return results;
  }

  /**
   * Reconstruct Keypair from ManagedWallet (via privateKey Base58 or mnemonic)
   */
  public static async getKeypair(wallet: ManagedWallet): Promise<Keypair> {
    if (wallet.privateKey) {
      const secretKey = bs58.decode(wallet.privateKey);
      return Keypair.fromSecretKey(secretKey);
    }
    if (wallet.mnemonic && wallet.mnemonic.length > 0) {
      return await this.deriveKeypairFromMnemonic(wallet.mnemonic);
    }
    throw new Error(`Wallet ${wallet.label} has no private key or mnemonic available`);
  }

  /**
   * Send Native SOL from a managed Solana wallet to a recipient
   */
  public static async sendSol(
    senderWallet: ManagedWallet,
    recipientAddress: string,
    amountSol: number | string,
    network: Network = 'mainnet'
  ): Promise<{ txHash: string; success: boolean; error?: string }> {
    try {
      if (!this.isValidAddress(recipientAddress)) {
        throw new Error('Invalid Solana recipient address: ' + recipientAddress);
      }

      const connection = this.getConnection(network);
      const senderKeypair = await this.getKeypair(senderWallet);
      const recipientPubkey = new PublicKey(recipientAddress);

      // Integer string math for lamports (9 decimals) — never float-multiply.
      const [solInt = '0', solFrac = ''] = String(amountSol).trim().split('.');
      const solFracPadded = (solFrac + '0'.repeat(9)).slice(0, 9);
      const lamportsToSend = Number(
        BigInt(solInt.replace(/\D/g, '') || '0') * 1000000000n + BigInt(solFracPadded.replace(/\D/g, '') || '0')
      );
      if (!Number.isSafeInteger(lamportsToSend) || lamportsToSend <= 0) {
        throw new Error('Invalid transfer amount: ' + amountSol);
      }

      // Check balance
      const senderLamports = await connection.getBalance(senderKeypair.publicKey);
      const estimatedFee = 5000; // 0.000005 SOL standard fee
      if (senderLamports < lamportsToSend + estimatedFee) {
        throw new Error(`Insufficient SOL balance. Required: ${((lamportsToSend + estimatedFee) / LAMPORTS_PER_SOL).toFixed(5)} SOL, Available: ${(senderLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL`);
      }

      const tx = new SolanaTransaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports: lamportsToSend,
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = senderKeypair.publicKey;
      tx.sign(senderKeypair);

      const rawTransaction = tx.serialize();
      const txHash = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction({
        signature: txHash,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return { txHash, success: true };
    } catch (err: any) {
      console.error('Error sending SOL:', err);
      return { txHash: '', success: false, error: err?.message || 'Transaction failed' };
    }
  }

  /**
   * Build a Squads Protocol v4 Multisig initialization transaction
   * Uses @sqds/multisig SDK instructions
   */
  public static async buildSquadsV4CreateMultisigTx(
    creatorKeypair: Keypair,
    members: PublicKey[],
    threshold: number = 1
  ): Promise<{ transaction: SolanaTransaction; multisigPda: string; vaultPda: string }> {
    const [multisigPda] = squads.getMultisigPda({
      createKey: creatorKeypair.publicKey,
      programId: SQUADS_V4_PROGRAM_ID,
    });

    const [vaultPda] = squads.getVaultPda({
      multisigPda,
      index: 0,
      programId: SQUADS_V4_PROGRAM_ID,
    });

    // Create Squads multisig instruction with creator as initial member and threshold
    const createIx = squads.instructions.multisigCreateV2({
      createKey: creatorKeypair.publicKey,
      creator: creatorKeypair.publicKey,
      multisigPda,
      treasury: vaultPda,
      configAuthority: null,
      threshold,
      members: members.map(key => ({
        key,
        permissions: squads.types.Permissions.all(),
      })),
      timeLock: 0,
      rentCollector: null,
      programId: SQUADS_V4_PROGRAM_ID,
    });

    const tx = new SolanaTransaction().add(createIx);
    return {
      transaction: tx,
      multisigPda: multisigPda.toBase58(),
      vaultPda: vaultPda.toBase58(),
    };
  }

  /**
   * Fast, rate-limit immune bulk token balances for a list of wallets using getMultipleAccountsInfo.
   * Derives ATAs offline for known tokens and queries in 100-account batches.
   */
  public static async fetchKnownTokensBulk(
    wallets: ManagedWallet[],
    network: Network = 'mainnet'
  ): Promise<Map<string, JettonBalance[]>> {
    const resultMap = new Map<string, JettonBalance[]>();
    wallets.forEach(w => resultMap.set(w.address, []));
    if (wallets.length === 0) return resultMap;

    const connection = this.getConnection(network);
    const tokensToCheck = SUPPORTED_SOLANA_TOKENS.filter(t => t.symbol !== 'SOL');
    const prices = PriceService.getPrices();

    interface AtaItem {
      walletAddress: string;
      ata: PublicKey;
      programId: PublicKey;
      tokenInfo: JettonTokenInfo;
    }
    const ataItems: AtaItem[] = [];

    for (const w of wallets) {
      try {
        const ownerPubkey = new PublicKey(w.address);
        for (const token of tokensToCheck) {
          const is2022 = token.masterAddress.endsWith('pump') || token.symbol === 'MYA';
          const programId = is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
          const ata = getAssociatedTokenAddressSync(
            new PublicKey(token.masterAddress),
            ownerPubkey,
            true,
            programId
          );
          ataItems.push({
            walletAddress: w.address,
            ata,
            programId,
            tokenInfo: token,
          });
        }
      } catch (e) {
        console.warn(`Error deriving ATAs for wallet ${w.address}:`, e);
      }
    }

    const CHUNK_SIZE = 100;
    for (let i = 0; i < ataItems.length; i += CHUNK_SIZE) {
      const chunk = ataItems.slice(i, i + CHUNK_SIZE);
      try {
        const publicKeys = chunk.map(item => item.ata);
        const accounts = await connection.getMultipleAccountsInfo(publicKeys);

        accounts.forEach((acc, idx) => {
          const item = chunk[idx];
          let uiAmount = '0.00';
          if (acc) {
            try {
              const unpacked = unpackAccount(item.ata, acc, item.programId);
              const rawAmount = unpacked.amount;
              uiAmount = (Number(rawAmount) / Math.pow(10, item.tokenInfo.decimals)).toString();
            } catch (err) {
              console.warn(`Error unpacking ATA ${item.ata.toBase58()}:`, err);
            }
          }

          const balNum = parseFloat(uiAmount);
          const price = item.tokenInfo.usdPrice || (prices.tokens[item.tokenInfo.symbol.toUpperCase()] || 0);
          const usdVal = balNum * price;

          const currentList = resultMap.get(item.walletAddress) || [];
          currentList.push({
            symbol: item.tokenInfo.symbol,
            name: item.tokenInfo.name,
            balance: balNum > 0 ? uiAmount : '0.00',
            decimals: item.tokenInfo.decimals,
            jettonAddress: item.tokenInfo.masterAddress,
            icon: item.tokenInfo.icon,
            usdValue: PriceService.formatUsd(usdVal, false),
          });
          resultMap.set(item.walletAddress, currentList);
        });
      } catch (e) {
        try {
          const fallbackConn = this.getFallbackConnection(network);
          const publicKeys = chunk.map(item => item.ata);
          const accounts = await fallbackConn.getMultipleAccountsInfo(publicKeys);

          accounts.forEach((acc, idx) => {
            const item = chunk[idx];
            let uiAmount = '0.00';
            if (acc) {
              try {
                const unpacked = unpackAccount(item.ata, acc, item.programId);
                const rawAmount = unpacked.amount;
                uiAmount = (Number(rawAmount) / Math.pow(10, item.tokenInfo.decimals)).toString();
              } catch (err) {
                console.warn(`Error unpacking ATA ${item.ata.toBase58()}:`, err);
              }
            }

            const balNum = parseFloat(uiAmount);
            const price = item.tokenInfo.usdPrice || (prices.tokens[item.tokenInfo.symbol.toUpperCase()] || 0);
            const usdVal = balNum * price;

            const currentList = resultMap.get(item.walletAddress) || [];
            currentList.push({
              symbol: item.tokenInfo.symbol,
              name: item.tokenInfo.name,
              balance: balNum > 0 ? uiAmount : '0.00',
              decimals: item.tokenInfo.decimals,
              jettonAddress: item.tokenInfo.masterAddress,
              icon: item.tokenInfo.icon,
              usdValue: PriceService.formatUsd(usdVal, false),
            });
            resultMap.set(item.walletAddress, currentList);
          });
        } catch (err2) {
          console.warn(`Error batch-fetching Solana ATAs chunk ${i}:`, err2);
        }
      }
    }

    return resultMap;
  }

  /**
   * Fetch all on-chain SPL Token accounts owned by an address
   * Returns null when the fetch fails so callers keep the last known token list.
   */
  public static async fetchSplTokens(
    addressStr: string,
    network: Network = 'mainnet'
  ): Promise<JettonBalance[] | null> {
    try {
      const connection = this.getConnection(network);
      const ownerPubkey = new PublicKey(addressStr);
      // Query both classic TOKEN_PROGRAM_ID accounts and modern TOKEN_2022_PROGRAM_ID accounts (for pump.fun & Token Extensions)
      const [classicRes, token2022Res] = await Promise.allSettled([
        connection.getParsedTokenAccountsByOwner(ownerPubkey, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection.getParsedTokenAccountsByOwner(ownerPubkey, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ]);

      // If both RPC calls failed (e.g. 429 rate limit), fall back to known ATA direct fetch
      if (classicRes.status === 'rejected' && token2022Res.status === 'rejected') {
        const dummyWallet: ManagedWallet = {
          id: 'temp',
          address: addressStr,
          chain: 'solana',
          label: '',
          version: 'solana-ed25519',
          tag: '',
          subwalletId: 0,
          rawAddress: addressStr,
          publicKey: addressStr,
          mnemonic: [],
          createdAt: 0,
          balance: '0',
          balanceNano: '0',
        };
        const bulkMap = await this.fetchKnownTokensBulk([dummyWallet], network);
        return bulkMap.get(addressStr) || null;
      }

      const allAccounts: any[] = [];
      if (classicRes.status === 'fulfilled') {
        allAccounts.push(...classicRes.value.value);
      }
      if (token2022Res.status === 'fulfilled') {
        allAccounts.push(...token2022Res.value.value);
      }

      const prices = PriceService.getPrices();
      const results: JettonBalance[] = [];

      for (const item of allAccounts) {
        const info = item.account.data.parsed?.info;
        if (!info) continue;
        const mint = info.mint as string;
        const tokenAmount = info.tokenAmount;
        const uiAmount = tokenAmount?.uiAmountString || '0';
        const decimals = tokenAmount?.decimals || 0;

        if (parseFloat(uiAmount) <= 0) continue;

        const known = SUPPORTED_SOLANA_TOKENS.find(t => t.masterAddress === mint);
        const isPumpFun = mint.endsWith('pump');
        const symbol = known 
          ? known.symbol 
          : (isPumpFun ? `${mint.substring(0, 4)}...pump` : `${mint.substring(0, 4)}...${mint.substring(mint.length - 4)}`);
        const name = known ? known.name : (isPumpFun ? `Pump.fun Token (${symbol})` : `Token ${symbol}`);
        const icon = known ? known.icon : (isPumpFun ? '💊' : '🪙');
        const price = known?.usdPrice || (prices.tokens[symbol.toUpperCase()] || 0);
        const usdVal = parseFloat(uiAmount) * price;

        results.push({
          symbol,
          name,
          balance: uiAmount,
          decimals,
          jettonAddress: mint,
          icon,
          usdValue: PriceService.formatUsd(usdVal, false),
        });
      }

      return results;
    } catch (err) {
      console.warn(`Error fetching SPL tokens for ${addressStr}:`, err);
      try {
        const dummyWallet: ManagedWallet = {
          id: 'temp',
          address: addressStr,
          chain: 'solana',
          label: '',
          version: 'solana-ed25519',
          tag: '',
          subwalletId: 0,
          rawAddress: addressStr,
          publicKey: addressStr,
          mnemonic: [],
          createdAt: 0,
          balance: '0',
          balanceNano: '0',
        };
        const bulkMap = await this.fetchKnownTokensBulk([dummyWallet], network);
        return bulkMap.get(addressStr) || null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Fetch complete assets for a Solana wallet (Native SOL + SPL Tokens)
   */
  public static async fetchWalletAssets(
    addressStr: string,
    network: Network = 'mainnet'
  ): Promise<{ balance: string; balanceNano: string; tokens: JettonBalance[] }> {
    const bal = await this.fetchBalance(addressStr, network);
    const splTokens = await this.fetchSplTokens(addressStr, network);
    return {
      balance: bal.balance,
      balanceNano: bal.balanceNano,
      tokens: splTokens,
    };
  }

  /**
   * Send SPL Token (USDC, USDT, BONK, etc.) with automatic Associated Token Account creation
   */
  public static async sendSplToken(
    senderWallet: ManagedWallet,
    recipientAddress: string,
    tokenSymbolOrMint: string,
    amountTokens: number | string,
    network: Network = 'mainnet'
  ): Promise<{ txHash: string; success: boolean; error?: string }> {
    try {
      if (!this.isValidAddress(recipientAddress)) {
        throw new Error('Invalid Solana recipient address: ' + recipientAddress);
      }

      const connection = this.getConnection(network);
      const senderKeypair = await this.getKeypair(senderWallet);
      const recipientPubkey = new PublicKey(recipientAddress);

      // Match token mint info
      const known = SUPPORTED_SOLANA_TOKENS.find(
        t => t.symbol.toUpperCase() === tokenSymbolOrMint.toUpperCase() || t.masterAddress === tokenSymbolOrMint
      );

      const mintAddress = known ? known.masterAddress : tokenSymbolOrMint;
      const mintPubkey = new PublicKey(mintAddress);

      // Determine token program (classic Token or Token-2022 for pump.fun / token extensions)
      const mintAccountInfo = await connection.getAccountInfo(mintPubkey);
      const tokenProgramId = mintAccountInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) 
        ? TOKEN_2022_PROGRAM_ID 
        : TOKEN_PROGRAM_ID;

      // Decimals: read from the mint itself, never guess. A wrong decimal
      // shifts the amount by orders of magnitude.
      const parsedMint = await connection.getParsedAccountInfo(mintPubkey);
      const mintDecimals = (parsedMint.value?.data as any)?.parsed?.info?.decimals;
      const decimals = known?.decimals ?? (typeof mintDecimals === 'number' ? mintDecimals : undefined);
      if (decimals === undefined) {
        throw new Error(`Unknown decimals for mint ${mintAddress}: refusing to guess. Add it to the token registry first.`);
      }

      // Derive Associated Token Addresses (ATA) using the proper tokenProgramId
      const senderAta = getAssociatedTokenAddressSync(mintPubkey, senderKeypair.publicKey, true, tokenProgramId);
      const recipientAta = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey, true, tokenProgramId);

      const tx = new SolanaTransaction();

      // Check if recipient ATA exists; if not, prepend instruction to create it
      const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
      const needsAtaCreation = !recipientAtaInfo;
      if (needsAtaCreation) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            senderKeypair.publicKey,
            recipientAta,
            recipientPubkey,
            mintPubkey,
            tokenProgramId
          )
        );
      }

      // Preflight SOL check: tx fee + ATA rent (when creating). Without this,
      // the tx fails on-chain with a confusing insufficient-funds error.
      const ATA_RENT_LAMPORTS = 2039280; // ~0.00204 SOL
      const estimatedFee = 5000;
      const senderLamports = await connection.getBalance(senderKeypair.publicKey);
      const requiredLamports = estimatedFee + (needsAtaCreation ? ATA_RENT_LAMPORTS : 0);
      if (senderLamports < requiredLamports) {
        throw new Error(
          `Insufficient SOL for fees${needsAtaCreation ? ' + recipient ATA rent' : ''}. ` +
          `Required: ${(requiredLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL, ` +
          `Available: ${(senderLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL`
        );
      }

      // Convert amount to atomic units with integer string math (never float).
      const [amtInt = '0', amtFrac = ''] = String(amountTokens).trim().split('.');
      const amtFracPadded = (amtFrac + '0'.repeat(decimals)).slice(0, decimals);
      const rawAmount = BigInt((amtInt.replace(/\D/g, '') || '0')) * (10n ** BigInt(decimals))
        + BigInt(amtFracPadded.replace(/\D/g, '') || '0');
      if (rawAmount <= BigInt(0)) {
        throw new Error('Invalid token amount: ' + amountTokens);
      }

      tx.add(
        createTransferInstruction(
          senderAta,
          recipientAta,
          senderKeypair.publicKey,
          rawAmount,
          [],
          tokenProgramId
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = senderKeypair.publicKey;
      tx.sign(senderKeypair);

      const rawTx = tx.serialize();
      const txHash = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction({
        signature: txHash,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return { txHash, success: true };
    } catch (err: any) {
      console.error('Error sending SPL Token:', err);
      return { txHash: '', success: false, error: err?.message || 'SPL Token transfer failed' };
    }
  }

  /**
   * Request SOL airdrop on Devnet / Testnet
   */
  public static async requestAirdrop(
    addressStr: string,
    amountSol: number = 1,
    network: Network = 'testnet'
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const connection = this.getConnection(network);
      const pubkey = new PublicKey(addressStr);
      const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
      const sig = await connection.requestAirdrop(pubkey, lamports);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      return { success: true, txHash: sig };
    } catch (e: any) {
      console.warn('Solana airdrop request failed:', e);
      return { success: false, error: e?.message || 'Airdrop request failed (faucet rate limited)' };
    }
  }

  /**
   * Get confirmed transaction history for a Solana address
   */
  public static async getTransactionHistory(
    addressStr: string,
    network: Network = 'mainnet',
    limit: number = 25
  ): Promise<Array<{
    signature: string;
    slot: number;
    blockTime: number | null;
    status: 'success' | 'failed';
    err: any;
    memo?: string | null;
  }>> {
    try {
      const connection = this.getConnection(network);
      const pubkey = new PublicKey(addressStr);
      const sigs = await connection.getSignaturesForAddress(pubkey, { limit });
      return sigs.map(s => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime,
        status: s.err ? 'failed' : 'success',
        err: s.err,
        memo: s.memo,
      }));
    } catch (e) {
      console.warn(`Error fetching tx history for ${addressStr}:`, e);
      return [];
    }
  }

  /**
   * Batch update balances and SPL tokens for Solana wallets with chunking & live callback
   */
  /**
   * Failure contract (same as TON): a failed fetch NEVER zeroes a wallet.
   * Missing bulk data or a failed SPL fetch keeps last-known values and
   * flags the wallet `balanceStale`.
   */
  public static async batchUpdateBalances(
    wallets: ManagedWallet[],
    network: Network = 'mainnet',
    onWalletUpdated?: (updatedWallet: ManagedWallet) => void,
    onProgress?: (done: number, total: number) => void
  ): Promise<ManagedWallet[]> {
    const updated = [...wallets];
    if (wallets.length === 0) return updated;

    // 1. Fetch native SOL balances in bulk via getMultipleAccountsInfo (100 per chunk)
    const addresses = wallets.map(w => w.address);
    const balanceMap = await this.fetchBalancesBulk(addresses, network);

    // 2. Fetch known SPL & Token-2022 tokens in bulk via getMultipleAccountsInfo (instant & rate-limit immune)
    const knownTokensMap = await this.fetchKnownTokensBulk(wallets, network);

    // 3. Immediately merge native + known tokens and fire live callbacks (runs in <350ms)
    let done = 0;
    for (let i = 0; i < updated.length; i++) {
      const wallet = updated[i];
      try {
        const res = balanceMap.get(wallet.address);
        const solBal = res ? res.balance : wallet.balance;
        const solNano = res ? res.balanceNano : wallet.balanceNano;

        // Known tokens from bulk ATA query (includes MYA, USDC, USDT, BONK, etc.)
        const knownTokens = knownTokensMap.get(wallet.address) || [];

        // Build token map: known tokens first
        const tokenMap = new Map<string, JettonBalance>();
        knownTokens.forEach(t => tokenMap.set(t.jettonAddress || t.symbol, t));

        // Preserve any previously known wallet tokens with balance > 0
        (wallet.jettons || []).forEach(existing => {
          const key = existing.jettonAddress || existing.symbol;
          if (parseFloat(existing.balance || '0') > 0 && !tokenMap.has(key)) {
            tokenMap.set(key, existing);
          }
        });

        const finalTokens = Array.from(tokenMap.values());

        const currentNetBalances = updated[i].networkBalances || {};
        const updatedNetBalances = {
          ...currentNetBalances,
          [network]: {
            ton: solBal,
            tonNano: solNano,
            jettons: finalTokens,
            nfts: updated[i].nfts || [],
          },
        };

        updated[i] = {
          ...updated[i],
          balance: solBal,
          balanceNano: solNano,
          jettons: finalTokens,
          networkBalances: updatedNetBalances,
          lastChecked: Date.now(),
          balanceStale: !res,
        };

        if (onWalletUpdated) {
          onWalletUpdated(updated[i]);
        }
      } catch (e) {
        console.warn(`Error updating Solana wallet ${wallet.address}:`, e);
        updated[i] = { ...updated[i], balanceStale: true };
        if (onWalletUpdated) onWalletUpdated(updated[i]);
      } finally {
        done++;
        if (onProgress) onProgress(done, updated.length);
      }
    }

    // 4. Background on-chain discovery for custom / unlisted tokens (non-blocking, 3s timeout)
    const priorityWallets = updated.filter(w => w.isMainWallet || w.isCustomImport);
    if (priorityWallets.length > 0) {
      (async () => {
        for (const pw of priorityWallets) {
          try {
            const timeoutPromise = new Promise<null>(r => setTimeout(() => r(null), 3000));
            const discovered = await Promise.race([
              this.fetchSplTokens(pw.address, network),
              timeoutPromise
            ]);
            if (discovered && discovered.length > 0) {
              const idx = updated.findIndex(w => w.address === pw.address);
              if (idx !== -1) {
                const currentJettons = updated[idx].jettons || [];
                const tMap = new Map<string, JettonBalance>();
                currentJettons.forEach(t => tMap.set(t.jettonAddress || t.symbol, t));
                let changed = false;
                discovered.forEach(d => {
                  const key = d.jettonAddress || d.symbol;
                  if (!tMap.has(key) || tMap.get(key)!.balance !== d.balance) {
                    tMap.set(key, d);
                    changed = true;
                  }
                });
                if (changed) {
                  const mergedJettons = Array.from(tMap.values());
                  updated[idx] = {
                    ...updated[idx],
                    jettons: mergedJettons,
                    networkBalances: {
                      ...updated[idx].networkBalances,
                      [network]: {
                        ton: updated[idx].balance,
                        tonNano: updated[idx].balanceNano,
                        jettons: mergedJettons,
                        nfts: updated[idx].nfts || [],
                      },
                    },
                  };
                  if (onWalletUpdated) onWalletUpdated(updated[idx]);
                }
              }
            }
          } catch (e) {
            console.warn(`Background discovery skipped for ${pw.address}:`, e);
          }
        }
      })().catch(() => {});
    }

    return updated;
  }
}

