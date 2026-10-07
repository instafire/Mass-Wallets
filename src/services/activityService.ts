export interface ActivityItem {
  id: string;
  type: 'generate' | 'send' | 'receive' | 'distribute' | 'sweep' | 'tag' | 'export' | 'import' | 'faucet' | 'security';
  title: string;
  description: string;
  walletCount?: number;
  fromAddress?: string;
  toAddress?: string;
  amount?: string;
  token?: string;
  timestamp: number;
  status: 'success' | 'pending' | 'failed';
  txHash?: string;
}

const STORAGE_KEY_ACTIVITY = 'tonkeeper_activity_log_v2';

export class ActivityService {
  private static activities: ActivityItem[] = [];
  private static listeners: Set<(items: ActivityItem[]) => void> = new Set();

  static {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ACTIVITY);
      if (raw) {
        this.activities = JSON.parse(raw);
      } else {
        // Initial welcome log
        this.activities = [
          {
            id: `act_${Date.now()}`,
            type: 'import',
            title: 'Master Vault Initialized',
            description: 'Tonkeeper Mass Wallet Studio ready.',
            timestamp: Date.now(),
            status: 'success',
          },
        ];
      }
    } catch {
      this.activities = [];
    }
  }

  public static getActivities(): ActivityItem[] {
    return this.activities;
  }

  public static subscribe(listener: (items: ActivityItem[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.activities);
    return () => this.listeners.delete(listener);
  }

  public static log(item: Omit<ActivityItem, 'id' | 'timestamp'>): void {
    const fullItem: ActivityItem = {
      ...item,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    this.activities = [fullItem, ...this.activities.slice(0, 199)]; // keep latest 200 items

    try {
      localStorage.setItem(STORAGE_KEY_ACTIVITY, JSON.stringify(this.activities));
    } catch {}

    this.listeners.forEach(fn => fn(this.activities));
  }

  public static clear(): void {
    this.activities = [];
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVITY);
    } catch {}
    this.listeners.forEach(fn => fn(this.activities));
  }
}
