import { NOW } from '../data/mock';

export type PiiKind = 'user' | 'email' | 'phone';

const maskUser = (u: string) => u.length <= 4 ? u[0] + '••' : u.slice(0, 2) + '••••' + u.slice(-2);
const maskEmail = (e: string) => {
  const [l, d = ''] = e.split('@');
  const [dn = '', ...tld] = d.split('.');
  return l[0] + '•••@' + dn[0] + '•••.' + tld.join('.');
};
const maskPhone = (p: string) => '••••• ••' + p.replace(/\D/g, '').slice(-3);

export const maskValue = (raw: string, kind: PiiKind, on: boolean) =>
  !on ? raw : kind === 'email' ? maskEmail(raw) : kind === 'phone' ? maskPhone(raw) : maskUser(raw);

/** Message text with {phone:...} tokens resolved to plain (possibly masked) text. */
export const bodyText = (s: string, mask: boolean) => s.replace(/\{phone:([^}]+)\}/g, (_, p: string) => maskValue(p, 'phone', mask));

export const money = (x: number) => '$' + x.toFixed(4);
export const ageShort = (m: number) => m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
export const ageLong = (m: number) => m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)} days ago`;
export const received = (m: number) => new Date(NOW.getTime() - m * 60000).toLocaleString('en-US',
  { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
export const waitBig = (m: number) => m >= 1440
  ? `${Math.floor(m / 1440)}d ${String(Math.floor(m % 1440 / 60)).padStart(2, '0')}h`
  : m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
/** median durations: m:ss under 10 minutes, whole minutes above */
export const secs = (s: number) => s < 60 ? `0:${String(s).padStart(2, '0')}` : s < 600 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${Math.round(s / 60)}m`;
export const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const initials = (n: string | null) => n ? n.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
