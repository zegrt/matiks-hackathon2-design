// Small shared pieces. Styling lives in styles/app.css; class names match the prototype.
import type { ReactNode } from 'react';
import { maskValue, type PiiKind } from '../lib/format';
import { whoKey } from '../lib/tickets';
import { useApp } from '../state';
import type { Ticket } from '../types';

export const Kbd = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

interface BtnProps { children: ReactNode; k?: string; onClick?: () => void; pri?: boolean; className?: string; title?: string }
/** Action button with its keyboard hint. */
export const Btn = ({ children, k, onClick, pri, className = '', title }: BtnProps) => (
  <button className={`btn ${pri ? 'pri' : ''} ${className}`} onClick={onClick} title={title}>
    {children}{k && <> <kbd>{k}</kbd></>}
  </button>
);

/** A PII value, masked unless the admin turned masking off. */
export function Pii({ raw, kind }: { raw?: string; kind: PiiKind }) {
  const { s } = useApp();
  return raw ? <span className="pii">{maskValue(raw, kind, s.mask)}</span> : null;
}

/** The reporter's best identifier: username, else email, else phone. */
export function Who({ t }: { t: Ticket }) {
  const [raw, kind] = whoKey(t);
  return <Pii raw={raw} kind={kind} />;
}

/** Message text; {phone:...} tokens become masked PII spans. */
export function Body({ text }: { text: string }) {
  const parts = text.split(/(\{phone:[^}]+\})/g);
  return <>{parts.map((p, i) => {
    const m = p.match(/^\{phone:([^}]+)\}$/);
    return m ? <Pii key={i} raw={m[1]} kind="phone" /> : p;
  })}</>;
}

export const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);
