import { mnemonicNew, mnemonicToWalletKey, mnemonicValidate } from '@ton/crypto';
import { 
  WalletContractV4, 
  WalletContractV3R2, 
  WalletContractV5R1, 
  TonClient, 
  toNano, 
  fromNano, 
  Address, 
  beginCell,
  type OpenedContract
} from '@ton/ton';
import type { 
  ManagedWallet, 
  WalletVersion, 
  Network, 
  Transaction, 
  JettonBalance, 
  JettonTokenInfo, 
  WalletHealthScore,
  NFTItem,
  NFTAttribute
} from '../types';
import { parseTokenUnits } from './tokenAmount';

// Default Tonkeeper Subwallet ID Constant
export const DEFAULT_TONKEEPER_SUBWALLET_ID = 698983191;

// Public TON Center RPC Endpoints
const RPC_ENDPOINTS: Record<Network, string> = {
  mainnet: 'https://toncenter.com/api/v2/jsonRPC',
  testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
};

const TONCENTER_V3: Record<Network, string> = {
  mainnet: 'https://toncenter.com/api/v3',
  testnet: 'https://testnet.toncenter.com/api/v3',
};

/**
 * Resolve the sender's jetton wallet address for a given jetton master.
 * Per TEP-74, a jetton transfer MUST be sent to the sender's OWN jetton
 * wallet contract (destination goes inside the payload). Sending the transfer
 * op to the recipient's plain wallet burns the attached TON and moves nothing.
 */
async function getSenderJettonWallet(
  ownerAddress: string,
  jettonMasterAddress: string,
  network: Network
): Promise<string> {
  const owner = Address.parse(ownerAddress).toRawString();
  const master = Address.parse(jettonMasterAddress).toRawString();
  const url = `${TONCENTER_V3[network]}/jetton/wallets?owner=${owner}&jetton=${master}&limit=1`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Jetton wallet lookup failed (HTTP ${resp.status})`);
  const json = await resp.json();
  const addr = json?.jetton_wallets?.[0]?.address;
  if (!addr) throw new Error('No jetton wallet found for sender — the wallet holds none of this token.');
  return addr;
}

// Popular TON Jettons Registry with verified mainnet master contract addresses
export const SUPPORTED_JETTONS: JettonTokenInfo[] = [
  {
    symbol: 'USDT',
    name: 'Tether USD (TON)',
    decimals: 6,
    masterAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    icon: '💵',
    usdPrice: 1.00,
  },
  {
    symbol: 'NOT',
    name: 'Notcoin',
    decimals: 9,
    masterAddress: 'EQAvlWFDxGF2lXm67y4yzC17wY6yRfeFuJlpDxG4y63bO6OS',
    icon: '🪙',
    usdPrice: 0.0085,
  },
  {
    symbol: 'DOGS',
    name: 'Dogs Token',
    decimals: 9,
    masterAddress: 'EQCvxJy4eG8h4nkM2fZlYHRpifu2ZiqUHyTwioY23XmBU--X',
    icon: '🐶',
    usdPrice: 0.0007,
  },
  {
    symbol: 'HMSTR',
    name: 'Hamster Kombat',
    decimals: 9,
    masterAddress: 'EQAJ8uWd7EBqsmpSWaFdfurlzvu6cmVXZHgLeZuYvvpqTLG4',
    icon: '🐹',
    usdPrice: 0.004,
  },
  {
    symbol: 'GRAM',
    name: 'Gram Token',
    decimals: 9,
    masterAddress: 'EQC47093oX5Xhb0xuk2lCr2RhS8upj1UpoxCIdfObPRVvdPr',
    icon: '💎',
    usdPrice: 0.012,
  },
];

export type SupportedWalletContract = WalletContractV4 | WalletContractV3R2 | WalletContractV5R1;

export class TonService {
  private static clientCache: Map<Network, TonClient> = new Map();

  /**
   * Get or initialize TonClient for a specific network
   */
  public static getClient(network: Network): TonClient {
    if (!this.clientCache.has(network)) {
      const client = new TonClient({
        endpoint: RPC_ENDPOINTS[network],
      });
      this.clientCache.set(network, client);
    }
    return this.clientCache.get(network)!;
  }

  /**
   * Create a single wallet with standard 24-word seed phrase and specified contract version
   */
  public static async createWallet(
    version: WalletVersion = 'v4R2',
    label: string = 'Wallet',
    tag: string = 'Generated',
    subwalletId: number = DEFAULT_TONKEEPER_SUBWALLET_ID
  ): Promise<ManagedWallet> {
    const mnemonic = await mnemonicNew(24);
    return await this.importWalletFromMnemonic(mnemonic, version, label, tag, subwalletId);
  }

  /**
   * Generate multiple wallets with non-blocking event loop yielding and progress updates
   */
  public static async generateBulkWallets(
    count: number,
    version: WalletVersion = 'v4R2',
    tagPrefix: string = 'Batch',
    subwalletId: number = DEFAULT_TONKEEPER_SUBWALLET_ID,
    onProgress?: (current: number, total: number) => void
  ): Promise<ManagedWallet[]> {
    const wallets: ManagedWallet[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
      const label = `${tagPrefix} #${i + 1}`;
      const wallet = await this.createWallet(version, label, tagPrefix, subwalletId);
      wallet.createdAt = timestamp + i;
      wallets.push(wallet);

      if (onProgress) {
        onProgress(i + 1, count);
      }

      // Yield execution to the browser event loop every 3 wallets to maintain UI responsiveness
      if (i % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return wallets;
  }

  /**
   * Import wallet from mnemonic words (12 or 24 words) with sanitized input & validation
   */
  public static async importWalletFromMnemonic(
    mnemonicInput: string[] | string,
    version: WalletVersion = 'v4R2',
    label: string = 'Imported Wallet',
    tag: string = 'Imported',
    subwalletId: number = DEFAULT_TONKEEPER_SUBWALLET_ID
  ): Promise<ManagedWallet> {
    const rawWords = Array.isArray(mnemonicInput)
      ? mnemonicInput
      : mnemonicInput.trim().split(/\s+/);

    const words = rawWords.map(w => w.trim().toLowerCase()).filter(w => w.length > 0);

    if (words.length !== 12 && words.length !== 24) {
      throw new Error(`Invalid mnemonic phrase length (${words.length} words). TON mnemonics must be 12 or 24 words.`);
    }

    // Validate mnemonic against the BIP-39 wordlist. An invalid phrase derives
    // keys that no real wallet can ever recover — importing it silently would
    // strand funds. Fail loudly instead.
    const isValid = await mnemonicValidate(words);
    if (!isValid) {
      throw new Error('Invalid mnemonic: checksum/wordlist validation failed. Check the words and try again.');
    }

    const key = await mnemonicToWalletKey(words);
    let walletContract: SupportedWalletContract;

    if (version === 'v4R2') {
      walletContract = WalletContractV4.create({
        publicKey: key.publicKey,
        workchain: 0,
        walletId: subwalletId,
      });
    } else if (version === 'v3R2') {
      walletContract = WalletContractV3R2.create({
        publicKey: key.publicKey,
        workchain: 0,
        walletId: subwalletId,
      });
    } else if (version === 'W5') {
      walletContract = WalletContractV5R1.create({
        publicKey: key.publicKey,
        workchain: 0,
      });
    } else {
      walletContract = WalletContractV4.create({
        publicKey: key.publicKey,
        workchain: 0,
      });
    }

    const addressObj: Address = walletContract.address;
    const address = addressObj.toString({ bounceable: false, urlSafe: true });
    const rawAddress = addressObj.toRawString();
    const publicKeyHex = key.publicKey.toString('hex');

    const defaultJettons: JettonBalance[] = [];

    return {
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      label,
      tag,
      mnemonic: words,
      publicKey: publicKeyHex,
      address,
      rawAddress,
      version,
      subwalletId,
      createdAt: Date.now(),
      balance: '0.00',
      balanceNano: '0',
      jettons: defaultJettons,
      networkBalances: {
        mainnet: { ton: '0.00', tonNano: '0', jettons: defaultJettons },
        testnet: { ton: '0.00', tonNano: '0', jettons: defaultJettons },
      },
    };
  }

  /**
   * Fetch live wallet balance from TON network RPC.
   * THROWS on failure — callers must not treat a failed fetch as a zero
   * balance (that wiped real balances from the vault on RPC rate limits).
   */
  public static async fetchBalance(addressStr: string, network: Network = 'mainnet'): Promise<{ balance: string; balanceNano: string }> {
    const errors: unknown[] = [];
    try {
      const client = this.getClient(network);
      const address = Address.parse(addressStr);
      const balanceNanoBigInt = await client.getBalance(address);
      const balanceNano = balanceNanoBigInt.toString();
      const balance = fromNano(balanceNanoBigInt);

      return {
        balance: parseFloat(balance).toFixed(4),
        balanceNano,
      };
    } catch (err) {
      errors.push(err);
      try {
        const apiBase = network === 'mainnet' ? 'https://toncenter.com/api/v2' : 'https://testnet.toncenter.com/api/v2';
        const url = `${apiBase}/getAddressInformation?address=${encodeURIComponent(addressStr)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json?.ok && json?.result?.balance !== undefined) {
          const nano = json.result.balance;
          return {
            balance: (Number(nano) / 1e9).toFixed(4),
            balanceNano: String(nano),
          };
        }
        throw new Error(`getAddressInformation not ok for ${addressStr}`);
      } catch (fallbackErr) {
        errors.push(fallbackErr);
        throw new Error(`Balance fetch failed for ${addressStr}: ${(errors[0] as Error)?.message || errors[0]}`);
      }
    }
  }

  /**
   * Fetch Jetton balances (e.g. USDT, NOT, DOGS) for a wallet address
   */
  /**
   * Returns null when the fetch fails so callers keep the last known
   * balances instead of wiping them.
   */
  public static async fetchJettonBalances(addressStr: string, network: Network = 'mainnet'): Promise<JettonBalance[] | null> {
    try {
      const baseUrl = network === 'mainnet' ? 'https://toncenter.com/api/v3' : 'https://testnet.toncenter.com/api/v3';
      const url = `${baseUrl}/jetton/wallets?owner_address=${encodeURIComponent(addressStr)}&limit=10`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Jetton fetch HTTP ${res.status}`);
      const json = await res.json();

      if (json?.jetton_wallets && Array.isArray(json.jetton_wallets) && json.jetton_wallets.length > 0) {
        return json.jetton_wallets.map((j: any) => {
          const masterAddr = j.jetton || j.jetton_address || '';
          const matched = SUPPORTED_JETTONS.find(t => 
            t.masterAddress.toLowerCase() === masterAddr.toLowerCase()
          );
          const symbol = matched ? matched.symbol : 'JETTON';
          const name = matched ? matched.name : 'TON Token';
          const decimals = matched ? matched.decimals : 9;
          const balanceFormatted = (Number(j.balance || 0) / Math.pow(10, decimals)).toFixed(decimals === 6 ? 2 : 4);
          const usdPrice = matched ? matched.usdPrice : 0;
          const usdValue = (parseFloat(balanceFormatted) * usdPrice).toFixed(2);

          return {
            symbol,
            name,
            balance: balanceFormatted,
            decimals,
            jettonAddress: masterAddr,
            icon: matched?.icon || '🪙',
            usdValue,
          };
        });
      }
    } catch (e) {
      console.warn('Jetton balance fetch warning:', e);
      return null;
    }
    return [];
  }

  /**
   * Helper to resolve IPFS / decentralized media URLs to reliable HTTP gateways
   */
  public static resolveNFTImageUrl(uri: string): string {
    if (!uri) return 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60';
    if (uri.startsWith('ipfs://')) {
      return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
    }
    if (uri.startsWith('ar://')) {
      return `https://arweave.net/${uri.replace('ar://', '')}`;
    }
    return uri;
  }

  /**
   * Fetch live NFTs owned by a wallet address from TON indexer (TonCenter v3 or TonAPI)
   */
  /**
   * Returns null when the fetch fails so callers keep the existing NFT
   * list instead of dropping it.
   */
  public static async fetchWalletNFTs(addressStr: string, network: Network = 'mainnet'): Promise<NFTItem[] | null> {
    try {
      const baseUrl = network === 'mainnet' ? 'https://toncenter.com/api/v3' : 'https://testnet.toncenter.com/api/v3';
      const url = `${baseUrl}/nft/items?owner_address=${encodeURIComponent(addressStr)}&limit=25`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`NFT fetch HTTP ${res.status}`);
      const json = await res.json();

      if (json?.nft_items && Array.isArray(json.nft_items) && json.nft_items.length > 0) {
        return json.nft_items.map((item: any) => {
          const content = item.content || {};
          const meta = item.metadata || content.metadata || {};
          const rawImg = meta.image || meta.image_url || content.uri || meta.preview || '';
          const resolvedImg = this.resolveNFTImageUrl(rawImg);

          const attributes: NFTAttribute[] = Array.isArray(meta.attributes)
            ? meta.attributes.map((a: any) => ({
                trait_type: a.trait_type || a.key || 'Trait',
                value: a.value || a.trait_value || 'Common',
              }))
            : [];

          return {
            id: item.address || `nft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            address: item.address,
            name: meta.name || item.name || `NFT #${item.index || 1}`,
            description: meta.description || item.description || '',
            image: resolvedImg,
            previewImage: resolvedImg,
            collectionName: item.collection?.name || item.collection_address ? 'TON Collection' : 'Standalone NFT',
            collectionAddress: item.collection_address || item.collection?.address,
            ownerAddress: addressStr,
            index: typeof item.index === 'number' ? item.index : parseInt(item.index) || undefined,
            attributes,
            verified: !!item.collection?.verified,
            addedAt: Date.now(),
          };
        });
      }
    } catch (e) {
      console.warn('Live NFT fetch warning:', e);
      return null; // fetch failed: caller keeps the existing list
    }

    return []; // fetch succeeded, wallet holds no NFTs
  }

  /**
   * Batch update balances and NFTs with chunking & throttling to prevent RPC rate limiting (429).
   *
   * Failure contract: a failed fetch NEVER zeroes a wallet. The last known
   * balance is kept and the wallet is flagged `balanceStale` so the UI can
   * show it honestly instead of pretending the wallet is empty.
   */
  public static async batchUpdateBalances(
    wallets: ManagedWallet[],
    network: Network = 'mainnet',
    onWalletUpdated?: (updatedWallet: ManagedWallet) => void,
    onProgress?: (done: number, total: number) => void
  ): Promise<ManagedWallet[]> {
    const updated = [...wallets];
    const CHUNK_SIZE = 5;
    let done = 0;

    for (let i = 0; i < updated.length; i += CHUNK_SIZE) {
      const chunk = updated.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (wallet, chunkOffset) => {
          const index = i + chunkOffset;
          try {
            const { balance, balanceNano } = await this.fetchBalance(wallet.address, network);
            const jettons = await this.fetchJettonBalances(wallet.address, network);
            const liveNfts = await this.fetchWalletNFTs(wallet.address, network);

            // null = fetch failed → keep the last known values
            const finalJettons = jettons === null ? (updated[index].jettons || []) : jettons;
            const existingNfts = (updated[index].nfts || []).filter(
              n => !n.id.startsWith('demo_') && !n.id.startsWith('sample_') && !n.id.startsWith('nft_sample_')
            );
            const customLocalNfts = existingNfts.filter(n => n.id.startsWith('custom_'));
            const finalNfts = liveNfts === null ? existingNfts : [...liveNfts, ...customLocalNfts];

            const currentNetBalances = updated[index].networkBalances || {};
            const updatedNetBalances = {
              ...currentNetBalances,
              [network]: {
                ton: balance,
                tonNano: balanceNano,
                jettons: finalJettons,
                nfts: finalNfts,
              },
            };

            updated[index] = {
              ...updated[index],
              balance,
              balanceNano,
              jettons: finalJettons,
              nfts: finalNfts,
              networkBalances: updatedNetBalances,
              lastChecked: Date.now(),
              balanceStale: false,
            };

            if (onWalletUpdated) {
              onWalletUpdated(updated[index]);
            }
          } catch (e) {
            // RPC failed (rate limit, timeout, …): keep last known balance,
            // flag it stale. Never write zeros.
            console.warn(`Balance refresh failed for ${wallet.address} — keeping last known value:`, (e as Error)?.message || e);
            updated[index] = {
              ...updated[index],
              balanceStale: true,
            };
            if (onWalletUpdated) {
              onWalletUpdated(updated[index]);
            }
          } finally {
            done++;
            if (onProgress) onProgress(done, updated.length);
          }
        })
      );

      // Throttle delay between chunks to respect free RPC rate limits
      if (i + CHUNK_SIZE < updated.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return updated;
  }

  /**
   * Fetch transaction history for a wallet
   */
  public static async fetchTransactions(addressStr: string, network: Network = 'mainnet'): Promise<Transaction[]> {
    try {
      const apiBase = network === 'mainnet' ? 'https://toncenter.com/api/v2' : 'https://testnet.toncenter.com/api/v2';
      const url = `${apiBase}/getTransactions?address=${encodeURIComponent(addressStr)}&limit=15`;
      const res = await fetch(url);
      const json = await res.json();

      if (json?.ok && Array.isArray(json?.result)) {
        return json.result.map((tx: any) => {
          const inMsg = tx.in_msg;
          const outMsgs = tx.out_msgs || [];
          const isIn = !!inMsg && inMsg.source !== '';

          let amountNano = '0';
          let sender = 'Unknown';
          let recipient = 'Unknown';
          let comment = '';

          if (isIn && inMsg) {
            amountNano = inMsg.value || '0';
            sender = inMsg.source || 'External';
            recipient = addressStr;
            comment = inMsg.message || inMsg.decoded_body?.text || '';
          } else if (outMsgs.length > 0) {
            amountNano = outMsgs[0].value || '0';
            sender = addressStr;
            recipient = outMsgs[0].destination || 'External';
            comment = outMsgs[0].message || outMsgs[0].decoded_body?.text || '';
          }

          return {
            hash: tx.transaction_id?.hash || `tx_${tx.utime}`,
            type: isIn ? 'in' : 'out',
            amount: (Number(amountNano) / 1e9).toFixed(4),
            sender,
            recipient,
            comment,
            timestamp: (tx.utime || Math.floor(Date.now() / 1000)) * 1000,
            fee: tx.fee ? (Number(tx.fee) / 1e9).toFixed(6) : '—',
            status: 'confirmed',
          };
        });
      }
    } catch (e) {
      console.warn('Failed to fetch transactions from RPC:', e);
    }
    return [];
  }

  /**
   * Generate Tonkeeper Web & Mobile Deep Link (TON & Jettons)
   */
  public static getTonkeeperDeepLink(
    toAddress: string,
    amountStr?: string,
    comment?: string,
    jettonAddress?: string,
    decimals = 9
  ): { webUrl: string; appUrl: string } {
    const params = new URLSearchParams();
    if (amountStr) {
      try {
        const rawUnits = parseTokenUnits(amountStr, decimals);
        if (rawUnits > 0n) params.append('amount', rawUnits.toString());
      } catch {
        // Incomplete/invalid form input should not crash the send modal.
      }
    }
    if (comment && comment.trim() !== '') {
      params.append('text', comment.trim());
    }
    if (jettonAddress) {
      params.append('jetton', jettonAddress);
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const webUrl = `https://app.tonkeeper.com/transfer/${toAddress}${queryString}`;
    const appUrl = `ton://transfer/${toAddress}${queryString}`;

    return { webUrl, appUrl };
  }

  /**
   * Send single TON or Jetton transaction using mnemonic seed phrase key
   */
  public static async sendTransaction(
    senderWallet: ManagedWallet,
    recipientAddress: string,
    amountStr: string,
    comment: string = '',
    network: Network = 'mainnet',
    tokenSymbol: string = 'TON',
    attachedGasTon: string = '0.012',
    forwardAmountTon: string = '0.0005',
    overrideSeqno?: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const key = await mnemonicToWalletKey(senderWallet.mnemonic);
      let walletContract: SupportedWalletContract;

      if (senderWallet.version === 'v4R2') {
        walletContract = WalletContractV4.create({
          publicKey: key.publicKey,
          workchain: 0,
          walletId: senderWallet.subwalletId || DEFAULT_TONKEEPER_SUBWALLET_ID,
        });
      } else if (senderWallet.version === 'v3R2') {
        walletContract = WalletContractV3R2.create({
          publicKey: key.publicKey,
          workchain: 0,
          walletId: senderWallet.subwalletId || DEFAULT_TONKEEPER_SUBWALLET_ID,
        });
      } else {
        walletContract = WalletContractV5R1.create({
          publicKey: key.publicKey,
          workchain: 0,
        });
      }

      const client = this.getClient(network);
      const contractProvider: OpenedContract<any> = client.open(walletContract);

      // Safe seqno lookup (handles uninitialized/undeployed contracts where getSeqno throws)
      let seqno = 0;
      if (typeof overrideSeqno === 'number') {
        seqno = overrideSeqno;
      } else {
        try {
          seqno = await contractProvider.getSeqno();
        } catch {
          seqno = 0;
        }
      }

      let transferMsg: any;

      if (tokenSymbol === 'TON' || tokenSymbol === '') {
        const nanoAmount = parseTokenUnits(amountStr, 9);
        if (nanoAmount <= 0n) throw new Error('Transfer amount must be greater than zero.');
        transferMsg = contractProvider.createTransfer({
          seqno,
          secretKey: key.secretKey,
          messages: [
            {
              to: Address.parse(recipientAddress),
              value: nanoAmount,
              body: comment,
              bounce: false,
            },
          ],
        });
      } else {
        // Jetton Token Payload construction (op code 0xf8a7ea5) with token-specific decimals.
        // TEP-74: the transfer message goes to the SENDER'S OWN jetton wallet,
        // with the recipient encoded inside the payload — never to the
        // recipient's plain address (that burns gas and moves nothing).
        const jettonInfo = SUPPORTED_JETTONS.find(t => t.symbol === tokenSymbol);
        if (!jettonInfo) {
          throw new Error(`Unknown jetton "${tokenSymbol}": decimals unverified. Refusing to guess — add it to the registry first.`);
        }
        const decimals = jettonInfo.decimals;
        const senderJettonWallet = await getSenderJettonWallet(
          senderWallet.rawAddress || senderWallet.address,
          jettonInfo.masterAddress,
          network
        );
        // Integer string math — never float-multiply token amounts.
        const rawUnits = parseTokenUnits(amountStr, decimals);
        if (rawUnits <= 0n) throw new Error('Jetton transfer amount must be greater than zero.');

        const forwardPayload = beginCell();
        if (comment) {
          forwardPayload.storeUint(0, 32).storeStringTail(comment);
        }

        const forwardTon = parseFloat(forwardAmountTon) > 0 ? forwardAmountTon : '0.0005';
        const attachedGas = parseFloat(attachedGasTon) > 0 ? attachedGasTon : '0.012';

        const jettonPayload = beginCell()
          .storeUint(0xf8a7ea5, 32) // transfer op
          .storeUint(0, 64) // query_id
          .storeCoins(rawUnits) // Token amount with exact decimals
          .storeAddress(Address.parse(recipientAddress)) // destination
          .storeAddress(Address.parse(senderWallet.address)) // response_destination
          .storeBit(0) // custom_payload
          .storeCoins(toNano(forwardTon)) // forward_ton_amount (optimized for airdrops)
          .storeBit(1) // store forward_payload in ref
          .storeRef(forwardPayload.endCell())
          .endCell();

        transferMsg = contractProvider.createTransfer({
          seqno,
          secretKey: key.secretKey,
          messages: [
            {
              to: Address.parse(senderJettonWallet),
              value: toNano(attachedGas), // gas for transfer
              body: jettonPayload,
              bounce: true,
            },
          ],
        });
      }

      await contractProvider.send(transferMsg);

      return {
        success: true,
        // NOTE: this is a LOCAL dispatch id, not an on-chain hash. The wallet
        // contract's send() resolves once the message is dispatched; the real
        // tx hash is only known after it lands. Shown as "dispatch id" in UI.
        txHash: `dispatched_${Date.now()}_seq${seqno}`,
      };
    } catch (err: any) {
      console.error('Send transaction error:', err);
      return {
        success: false,
        error: err?.message || 'Transaction failed. Check network balance.',
      };
    }
  }

  /**
   * Send single NFT transfer transaction (TEP-62 Standard)
   */
  public static async sendNFT(
    senderWallet: ManagedWallet,
    nftItemAddress: string,
    recipientAddress: string,
    comment: string = '',
    network: Network = 'mainnet',
    attachedGasTon: string = '0.05',
    forwardAmountTon: string = '0.01'
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const key = await mnemonicToWalletKey(senderWallet.mnemonic);
      let walletContract: SupportedWalletContract;

      if (senderWallet.version === 'v4R2') {
        walletContract = WalletContractV4.create({
          publicKey: key.publicKey,
          workchain: 0,
          walletId: senderWallet.subwalletId || DEFAULT_TONKEEPER_SUBWALLET_ID,
        });
      } else if (senderWallet.version === 'v3R2') {
        walletContract = WalletContractV3R2.create({
          publicKey: key.publicKey,
          workchain: 0,
          walletId: senderWallet.subwalletId || DEFAULT_TONKEEPER_SUBWALLET_ID,
        });
      } else {
        walletContract = WalletContractV5R1.create({
          publicKey: key.publicKey,
          workchain: 0,
        });
      }

      const client = this.getClient(network);
      const contractProvider: OpenedContract<any> = client.open(walletContract);

      let seqno = 0;
      try {
        seqno = await contractProvider.getSeqno();
      } catch {
        seqno = 0;
      }

      // Build standard TEP-62 NFT transfer cell body
      let forwardPayloadCell = beginCell().endCell();
      if (comment) {
        forwardPayloadCell = beginCell()
          .storeUint(0, 32) // text comment opcode
          .storeStringTail(comment)
          .endCell();
      }

      const nftTransferPayload = beginCell()
        .storeUint(0x5fcc3d14, 32) // TEP-62 transfer op code
        .storeUint(0, 64)          // query_id
        .storeAddress(Address.parse(recipientAddress)) // new_owner
        .storeAddress(Address.parse(senderWallet.address)) // response_destination
        .storeBit(0)               // custom_payload (null)
        .storeCoins(toNano(forwardAmountTon)) // forward_amount
        .storeBit(1)               // forward_payload in ref
        .storeRef(forwardPayloadCell)
        .endCell();

      const transferMsg = (contractProvider as any).createTransfer({
        seqno,
        secretKey: key.secretKey,
        messages: [
          {
            to: Address.parse(nftItemAddress),
            value: toNano(attachedGasTon), // gas attached for transfer processing
            body: nftTransferPayload,
            bounce: true,
          },
        ],
      });

      await contractProvider.send(transferMsg);

      return {
        success: true,
        // Local dispatch id, not an on-chain hash (see note in sendTransaction).
        txHash: `nft_dispatched_${Date.now()}_seq${seqno}`,
      };
    } catch (err: any) {
      console.error('Send NFT error:', err);
      return {
        success: false,
        error: err?.message || 'NFT transfer failed. Check gas balance.',
      };
    }
  }

  /**
   * Get Tonkeeper Deep Link for NFT transfer
   */
  public static getTonkeeperNFTTransferDeepLink(
    nftItemAddress: string,
    recipientAddress?: string,
    comment: string = ''
  ): { webUrl: string; appUrl: string } {
    const params = new URLSearchParams();
    params.set('amount', '50000000'); // 0.05 TON default gas
    const memo = comment ? `${comment} (To: ${recipientAddress || 'Recipient'})` : (recipientAddress ? `Transfer to ${recipientAddress}` : '');
    if (memo) params.set('text', memo);

    const queryString = `?${params.toString()}`;
    const webUrl = `https://app.tonkeeper.com/transfer/${nftItemAddress}${queryString}`;
    const appUrl = `ton://transfer/${nftItemAddress}${queryString}`;

    return { webUrl, appUrl };
  }

  /**
   * Audit Managed Wallet Studio Security & Health Score
   */
  public static auditWalletHealth(wallets: ManagedWallet[], isVaultEncrypted: boolean): WalletHealthScore {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (wallets.length === 0) {
      return {
        score: 100,
        level: 'Excellent',
        issues: [],
        recommendations: ['Create or import wallets to initiate studio monitoring.'],
      };
    }

    if (!isVaultEncrypted) {
      score -= 25;
      issues.push('Local vault storage is unencrypted without a master PIN.');
      recommendations.push('Set a master security PIN to encrypt local storage with AES-256.');
    }

    const unbackedCount = wallets.filter(w => !w.mnemonic || w.mnemonic.length === 0).length;
    if (unbackedCount > 0) {
      score -= 30;
      issues.push(`${unbackedCount} wallet(s) missing seed phrase backups.`);
      recommendations.push('Export your Master Vault Recovery file immediately.');
    }

    // Duplicate wallets: same address imported twice splits your view of funds
    // and causes double-sends in mass operations.
    const seen = new Map<string, number>();
    for (const w of wallets) {
      const key = (w.rawAddress || w.address || '').toLowerCase();
      if (key) seen.set(key, (seen.get(key) || 0) + 1);
    }
    const dupGroups = [...seen.values()].filter(c => c > 1).length;
    if (dupGroups > 0) {
      const dupWallets = [...seen.values()].filter(c => c > 1).reduce((a, b) => a + b, 0);
      score -= 10;
      issues.push(`${dupWallets} wallet(s) are duplicates across ${dupGroups} address(es).`);
      recommendations.push('Remove duplicate entries so mass operations don\'t double-count or double-send.');
    }

    // Stale balances: refresh failed for these, values may be outdated.
    const staleCount = wallets.filter(w => w.balanceStale).length;
    if (staleCount > 0) {
      score -= 5;
      issues.push(`${staleCount} wallet(s) show stale balances (last refresh failed).`);
      recommendations.push('Re-run Refresh — RPC rate limits often clear on a second pass.');
    }

    const zeroBalanceCount = wallets.filter(w => parseFloat(w.balance || '0') === 0).length;
    if (zeroBalanceCount === wallets.length) {
      issues.push('All wallets currently have 0.00 TON balance.');
      recommendations.push('Fund at least one primary wallet on Testnet or Mainnet.');
    }

    let level: WalletHealthScore['level'] = 'Excellent';
    if (score < 50) level = 'Risk';
    else if (score < 75) level = 'Fair';
    else if (score < 95) level = 'Good';

    return {
      score: Math.max(0, score),
      level,
      issues,
      recommendations,
    };
  }

  /**
   * Validate TON Address string
   */
  public static isValidAddress(addressStr: string): boolean {
    try {
      Address.parse(addressStr);
      return true;
    } catch {
      return false;
    }
  }
}
