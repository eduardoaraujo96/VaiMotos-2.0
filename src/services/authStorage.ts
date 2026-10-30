import type { User } from '../types';

export const SESSION_KEY = 'vaimoto.session';
export const ACCOUNTS_KEY = 'vaimoto.accounts';

export interface LocalAccount {
  email: string;
  password: string;
  user: User;
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function persistUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function readAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

export function writeAccounts(accounts: LocalAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function upsertLocalAccount(account: LocalAccount): void {
  const accounts = readAccounts().filter((item) => item.email !== account.email.toLowerCase());
  accounts.push({ ...account, email: account.email.toLowerCase() });
  writeAccounts(accounts);
}

export function findLocalAccount(email: string): LocalAccount | undefined {
  return readAccounts().find((item) => item.email === email.toLowerCase());
}
