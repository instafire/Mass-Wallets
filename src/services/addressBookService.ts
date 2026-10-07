export interface ContactEntry {
  id: string;
  label: string;
  address: string;
  tag: string;
  notes?: string;
  createdAt: number;
}

const STORAGE_KEY_CONTACTS = 'tonkeeper_address_book_v2';

const DEFAULT_CONTACTS: ContactEntry[] = [
  {
    id: 'c_dedust',
    label: 'DeDust Liquidity Router',
    address: 'EQA-X_yo3fzzbPt_YAssPPkrEdPkYTrjadParsleVU5CnPWa',
    tag: 'DEX',
    notes: 'DeDust.io main swap router v2',
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'c_stonfi',
    label: 'STON.fi DEX Router',
    address: 'EQB3ncyBUTjZUA3FeqqGeFdUmZ61qCnJSTzkioQsQrvw63zN',
    tag: 'DEX',
    notes: 'STON.fi DEX v1 Router',
    createdAt: Date.now() - 86400000 * 4,
  },
];

export class AddressBookService {
  private static contacts: ContactEntry[] = [];
  private static listeners: Set<(items: ContactEntry[]) => void> = new Set();

  static {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONTACTS);
      if (raw) {
        this.contacts = JSON.parse(raw);
      } else {
        this.contacts = DEFAULT_CONTACTS;
      }
    } catch {
      this.contacts = DEFAULT_CONTACTS;
    }
  }

  public static getContacts(): ContactEntry[] {
    return this.contacts;
  }

  public static subscribe(listener: (items: ContactEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.contacts);
    return () => this.listeners.delete(listener);
  }

  public static addContact(label: string, address: string, tag = 'General', notes = ''): ContactEntry {
    const trimmedAddress = address.trim();
    const entry: ContactEntry = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: label.trim(),
      address: trimmedAddress,
      tag: tag.trim() || 'General',
      notes: notes.trim(),
      createdAt: Date.now(),
    };

    this.contacts = [entry, ...this.contacts];
    this.save();
    return entry;
  }

  public static removeContact(id: string): void {
    this.contacts = this.contacts.filter(c => c.id !== id);
    this.save();
  }

  private static save(): void {
    try {
      localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(this.contacts));
    } catch {}
    this.listeners.forEach(fn => fn(this.contacts));
  }
}
