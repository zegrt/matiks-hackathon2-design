import { useState, type KeyboardEvent } from 'react';
import { CHANNEL } from '../../data/mock';
import { label } from '../../lib/tickets';
import { useApp } from '../../state';
import type { Ticket } from '../../types';
import { Who } from '../ui';

type Match = { id: string; t: Ticket } | { id: string; l: string; k: string };

export function Palette() {
  const { s, d } = useApp();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);

  const ql = q.trim().toLowerCase();
  const cmds: [string, string, string][] = [['cmd:insights', 'Go to Insights', 'Page'], ['cmd:evals', 'Go to Evals', 'Page'],
    ['cmd:theme', `Switch to ${s.theme === 'dark' ? 'light' : 'dark'} mode`, 'Command'], ['cmd:mask', `${s.mask ? 'Unmask' : 'Mask'} PII`, 'Command']];
  // searches unmasked values on purpose: the admin types what they know
  const tk = s.tickets.filter(t => !ql || [t.ext, label(t), t.reporter.username, t.reporter.email, t.reporter.phone, t.subject, ...t.body]
    .filter(Boolean).join(' ').toLowerCase().includes(ql));
  const m: Match[] = [...tk.slice(0, 7).map(t => ({ id: t.id, t })), ...cmds.filter(c => !ql || c[1].toLowerCase().includes(ql)).map(([id, l, k]) => ({ id, l, k }))];
  const at = Math.min(i, Math.max(0, m.length - 1));

  function go(id: string) {
    if (!id.startsWith('cmd:')) return d({ type: 'goto', id });
    const c = id.slice(4);
    if (c === 'insights' || c === 'evals') return d({ type: 'view', view: c });
    d({ type: c === 'theme' ? 'toggleTheme' : 'toggleMask' });
    d({ type: 'close' });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(at + 1, m.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(at - 1, 0)); }
    if (e.key === 'Enter' && m[at]) go(m[at].id);
    if (e.key === 'Escape') d({ type: 'close' });
  }

  return (
    <>
      <div className="scrim" onClick={() => d({ type: 'close' })} />
      <div className="pop palette">
        <input autoFocus placeholder="Ticket id, username, email or words from the message" value={q} autoComplete="off"
          onChange={e => { setQ(e.target.value); setI(0); }} onKeyDown={onKey} />
        <ul>
          {!m.length ? <li><span>No matches</span></li> : m.map((x, n) => 't' in x
            ? <li key={x.id} className={n === at ? 'on' : ''} onClick={() => go(x.id)}><b>{label(x.t)}</b><span className="st">{x.t.status === 'triaged' ? 'to review' : x.t.status === 'open' ? 'with agent' : x.t.status}</span><span><Who t={x.t} /> · {CHANNEL[x.t.channel]} · <span className="mono">{x.t.ext}</span></span><span /></li>
            : <li key={x.id} className={n === at ? 'on' : ''} onClick={() => go(x.id)}><b>{x.l}</b><span className="st">{x.k}</span></li>)}
        </ul>
        <div className="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span><span style={{ marginLeft: 'auto' }}>Searches unmasked values</span></div>
      </div>
    </>
  );
}
