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
  tonUsd: 1.44,
  change24h: -5.10,
  solUsd: 115.80,
  change24hSol: -4.15,
  tokens: {
    TON: 1.44,
    SOL: 115.80,
    USDT: 1.00,
    USDC: 1.00,
    NOT: 0.00045,
    DOGS: 0.000044,
    HMSTR: 0.0038,
    GRAM: 0.0115,
    TONGRAM: 0.045,
    BONK: 0.0000035,
    JUP: 0.32,
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
  private static pollTimer: ReturnType<typeof setInterval> | null = null;

  public static getPrices(): PriceData {
    return this.currentPrices;
  }

  public static subscribe(listener: (prices: PriceData) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentPrices);

    if (this.listeners.size === 1) {
      this.fetchLatestPrices();
      if (!this.pollTimer) {
        this.pollTimer = setInterval(() => {
          this.fetchLatestPrices();
        }, 45000);
      }
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };
  }

  public static async fetchLatestPrices(): Promise<PriceData> {
    if (this.isFetching) return this.currentPrices;
    this.isFetching = true;

    try {
      // 1. Try CoinGecko public API
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
        const tonPrice = data['the-open-network']?.usd || this.currentPrices.tonUsd || DEFAULT_PRICES.tonUsd;
        const tonChange = data['the-open-network']?.usd_24h_change ?? this.currentPrices.change24h ?? DEFAULT_PRICES.change24h;
        const solPrice = data['solana']?.usd || this.currentPrices.solUsd || DEFAULT_PRICES.solUsd;
        const solChange = data['solana']?.usd_24h_change ?? this.currentPrices.change24hSol ?? DEFAULT_PRICES.change24hSol;
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
        return this.currentPrices;
      }
    } catch {
      // Proceed to fallback
    }

    // 2. Fallback to Binance ticker if CoinGecko is rate-limited or unavailable
    try {
      const bResp = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=[%22TONUSDT%22,%22SOLUSDT%22]');
      if (bResp.ok) {
        const bData = await bResp.json();
        const tonItem = Array.isArray(bData) ? bData.find((x: any) => x.symbol === 'TONUSDT') : null;
        const solItem = Array.isArray(bData) ? bData.find((x: any) => x.symbol === 'SOLUSDT') : null;
        const tonPrice = tonItem ? parseFloat(tonItem.lastPrice) : this.currentPrices.tonUsd;
        const tonChange = tonItem ? parseFloat(tonItem.priceChangePercent) : this.currentPrices.change24h;
        const solPrice = solItem ? parseFloat(solItem.lastPrice) : this.currentPrices.solUsd;
        const solChange = solItem ? parseFloat(solItem.priceChangePercent) : this.currentPrices.change24hSol;

        this.currentPrices = {
          tonUsd: tonPrice,
          change24h: tonChange,
          solUsd: solPrice,
          change24hSol: solChange,
          tokens: {
            ...this.currentPrices.tokens,
            TON: tonPrice,
            SOL: solPrice,
          },
          lastUpdated: Date.now(),
          source: 'live',
        };
        this.listeners.forEach(fn => fn(this.currentPrices));
        return this.currentPrices;
      }
    } catch {}

    // 3. If all requests failed, mark stale
    this.currentPrices = { ...this.currentPrices, source: 'stale' };
    this.listeners.forEach(fn => fn(this.currentPrices));
    this.isFetching = false;
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
