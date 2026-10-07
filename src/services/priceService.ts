export interface PriceData {
  tonUsd: number;
  change24h: number;
  solUsd: number;
  change24hSol: number;
  tokens: Record<string, number>;
  lastUpdated: number;
  /** 'live' = fresh from API, 'stale' = API failed, showing last known, 'default' = never fetched (hardcoded) */
  source: 'live' | 'stale' | 'default';
}

const DEFAULT_PRICES: PriceData = {
  tonUsd: 5.42,
  change24h: 3.85,
  solUsd: 154.20,
  change24hSol: 2.15,
  tokens: {
    TON: 5.42,
    SOL: 154.20,
    USDT: 1.00,
    USDC: 1.00,
    NOT: 0.0078,
    DOGS: 0.00065,
    HMSTR: 0.0038,
    GRAM: 0.0115,
    TONGRAM: 0.045,
    BONK: 0.000021,
    JUP: 0.85,
    RAY: 1.75,
    WIF: 2.35,
    PYTH: 0.38,
    MYA: 0.000000795,
  },
  lastUpdated: Date.now(),
  source: 'default',
};

export class PriceService {
  private static currentPrices: PriceData = DEFAULT_PRICES;
  private static listeners: Set<(prices: PriceData) => void> = new Set();
  private static isFetching = false;

  public static getPrices(): PriceData {
    return this.currentPrices;
  }

  public static subscribe(listener: (prices: PriceData) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentPrices);
    return () => this.listeners.delete(listener);
  }

  public static async fetchLatestPrices(): Promise<PriceData> {
    if (this.isFetching) return this.currentPrices;
    this.isFetching = true;

    try {
      // Query CoinGecko public API for TON & Solana
      const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana,notcoin,dogs-2,bonk,jupiter-exchange-solana&vs_currencies=usd&include_24hr_change=true');
      
      let myaPrice = DEFAULT_PRICES.tokens.MYA;
      try {
        const dsResp = await fetch('https://api.dexscreener.com/latest/dex/tokens/AdgYuCBng63wg8NRAAep57wZF6ptTi9hHoFFTEzwpump');
        if (dsResp.ok) {
          const dsData = await dsResp.json();
          if (dsData.pairs && dsData.pairs.length > 0) {
            const p = parseFloat(dsData.pairs[0].priceUsd);
            if (!isNaN(p) && p > 0) {
              myaPrice = p;
            }
          }
        }
      } catch {}

      if (resp.ok) {
        const data = await resp.json();
        const tonPrice = data['the-open-network']?.usd || DEFAULT_PRICES.tonUsd;
        const tonChange = data['the-open-network']?.usd_24h_change || DEFAULT_PRICES.change24h;
        const solPrice = data['solana']?.usd || DEFAULT_PRICES.solUsd;
        const solChange = data['solana']?.usd_24h_change || DEFAULT_PRICES.change24hSol;
        const notPrice = data['notcoin']?.usd || DEFAULT_PRICES.tokens.NOT;
        const dogsPrice = data['dogs-2']?.usd || DEFAULT_PRICES.tokens.DOGS;
        const bonkPrice = data['bonk']?.usd || DEFAULT_PRICES.tokens.BONK;
        const jupPrice = data['jupiter-exchange-solana']?.usd || DEFAULT_PRICES.tokens.JUP;

        this.currentPrices = {
          tonUsd: tonPrice,
          change24h: tonChange,
          solUsd: solPrice,
          change24hSol: solChange,
          tokens: {
            ...DEFAULT_PRICES.tokens,
            TON: tonPrice,
            SOL: solPrice,
            USDT: 1.00,
            USDC: 1.00,
            NOT: notPrice,
            DOGS: dogsPrice,
            BONK: bonkPrice,
            JUP: jupPrice,
            MYA: myaPrice,
          },
          lastUpdated: Date.now(),
          source: 'live',
        };

        this.listeners.forEach(fn => fn(this.currentPrices));
      } else {
        // API answered but not OK: keep last known prices, mark them stale so
        // the UI never presents hardcoded defaults as live market data.
        this.currentPrices = { ...this.currentPrices, source: 'stale' };
        this.listeners.forEach(fn => fn(this.currentPrices));
      }
    } catch {
      // Network failure: keep last known prices, mark stale.
      this.currentPrices = { ...this.currentPrices, source: 'stale' };
      this.listeners.forEach(fn => fn(this.currentPrices));
    } finally {
      this.isFetching = false;
    }

    return this.currentPrices;
  }

  public static formatUsd(amountInTonOrUsd: number, isTon = true): string {
    if (isNaN(amountInTonOrUsd)) return '$0.00';
    const usdVal = isTon ? amountInTonOrUsd * (this.currentPrices.tonUsd || DEFAULT_PRICES.tonUsd) : amountInTonOrUsd;
    const absVal = Math.abs(usdVal);
    const sign = usdVal < 0 ? '-' : '';

    if (absVal >= 1000000) {
      return `${sign}$${(absVal / 1000000).toFixed(2)}M`;
    }
    if (absVal >= 10000) {
      return `${sign}$${(absVal / 1000).toFixed(1)}k`;
    }
    return `${sign}$${absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  public static formatSolUsd(amountInSol: number): string {
    if (isNaN(amountInSol)) return '$0.00';
    const usdVal = amountInSol * (this.currentPrices.solUsd || DEFAULT_PRICES.solUsd);
    const absVal = Math.abs(usdVal);
    const sign = usdVal < 0 ? '-' : '';

    if (absVal >= 1000000) {
      return `${sign}$${(absVal / 1000000).toFixed(2)}M`;
    }
    if (absVal >= 10000) {
      return `${sign}$${(absVal / 1000).toFixed(1)}k`;
    }
    return `${sign}$${absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  public static formatTokenUsd(amount: number, symbol: string): string {
    if (isNaN(amount) || amount === 0) return '$0.00';
    const rate = this.currentPrices.tokens[symbol] || 0;
    const usd = amount * rate;
    return this.formatUsd(usd, false);
  }
}
