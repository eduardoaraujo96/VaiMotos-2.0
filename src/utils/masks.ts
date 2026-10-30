const PHONE_RE = /^\(\d{2}\) \d{4,5}-\d{4}$/;
const PLATE_OLD_RE = /^[A-Z]{3}-\d{4}$/;
const PLATE_MERCOSUL_RE = /^[A-Z]{3}\d[A-Z]\d{2}$/;
const CNH_RE = /^\d{11}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function digitsOnly(value: string, max = 32): string {
  return value.replace(/\D/g, '').slice(0, max);
}

export function maskPhone(value: string): string {
  const digits = digitsOnly(value, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidPhone(value: string): boolean {
  const digits = digitsOnly(value, 11);
  return digits.length === 10 || digits.length === 11 || PHONE_RE.test(value);
}

export function maskPlate(value: string): string {
  const raw = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7);
  if (raw.length <= 3) return raw;
  const fourth = raw[3] ?? '';
  const fifth = raw[4] ?? '';
  const mercosul = /\d/.test(fourth) && (fifth === '' || /[A-Z]/.test(fifth));
  if (mercosul && raw.length >= 5) return raw;
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

export function isValidPlate(value: string): boolean {
  const normalized = maskPlate(value);
  return PLATE_OLD_RE.test(normalized) || PLATE_MERCOSUL_RE.test(normalized.replace('-', ''));
}

export function maskCnh(value: string): string {
  return digitsOnly(value, 11);
}

export function isValidCnh(value: string): boolean {
  return CNH_RE.test(digitsOnly(value, 11));
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidName(value: string): boolean {
  return value.trim().length >= 3;
}
