// React glue for the reducer: provider, data loading, live updates, and the useApp hook.
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { api, type ActionPayload } from './api';
import type { Ticket } from './types';
import { counts, groups, order, type Counts, type Group, type QueueQuery } from './lib/tickets';
import { init, queryOf, reducer, store, type Action, type Decision, type Overlay, type State } from './reducer';

export * from './reducer';

// ── context ──
interface App {
  s: State;
  d: Dispatch<Action>;
  q: QueueQuery;
  groups: Group[];
  order: string[];
  counts: Counts;
  /** the open ticket in the queue view */
  cur: Ticket | null;
  /** apply a decision and write it to `actions` */
  act: (kind: Decision, opts?: { reason?: string; text?: string }) => void;
  approveAll: () => void;
  /** open an overlay anchored to the element that triggered it */
  open: (overlay: Exclude<Overlay, null>, el?: Element | null) => void;
}
const Ctx = createContext<App | null>(null);

const API_ACTION: Record<Decision, ActionPayload['action']> = {
  approve: 'approve', save: 'edit', reject: 'reject', handoff: 'escalate', close: 'close', note: 'note', reopen: 'reopen',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, undefined, init);
  const [, setErr] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([api.tickets(), api.channels(), api.insights(), api.evals()])
      .then(([tickets, channels, insights, evals]) => d({ type: 'loaded', tickets, channels, insights, evals }))
      .catch(setErr);
    return api.subscribe(ticket => {
      d({ type: 'ticket', ticket });
      if (ticket.isNew) setTimeout(() => d({ type: 'ticket', ticket: { ...ticket, isNew: false } }), 1700);
    });
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = s.theme; store.set('dispatch.theme', s.theme); }, [s.theme]);
  useEffect(() => { if (s.actor) store.set('dispatch.actor', s.actor); }, [s.actor]);
  useEffect(() => {
    if (!s.toast) return;
    const id = s.toast.id, t = setTimeout(() => d({ type: 'toastDone', id }), s.toast.undo ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [s.toast]);

  const value = useMemo<App>(() => {
    const q = queryOf(s);
    const cur = s.view === 'queue' && s.sel ? s.tickets.find(t => t.id === s.sel) ?? null : null;
    return {
      s, d, q, groups: groups(q), order: order(q, s.showOff), counts: counts(s.tickets), cur,
      act(kind, opts = {}) {
        if (!cur) return;
        if ((kind === 'save' && !s.editText.trim()) || (kind === 'note' && !opts.text?.trim())) return;
        const body = kind === 'save' ? s.editText : [opts.reason, opts.text].filter(Boolean).join(' · ') || undefined;
        d({ type: 'decide', kind, id: cur.id, ...opts });
        api.recordAction(cur.id, { action: API_ACTION[kind], draftId: kind === 'approve' ? `${cur.id}-draft` : undefined, body }, s.actor || 'console')
          .catch(e => console.error('recordAction failed', e));
      },
      approveAll() {
        const auto = groups(q).find(g => g.key === 'auto')?.items ?? [];
        d({ type: 'approveAll' });
        auto.forEach(t => api.recordAction(t.id, { action: 'approve', draftId: `${t.id}-draft` }, s.actor || 'console').catch(console.error));
      },
      open(overlay, el) {
        const r = el?.getBoundingClientRect();
        d({ type: 'open', overlay, anchor: r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null });
      },
    };
  }, [s]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): App {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** Re-renders every second; for live timers. */
export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  return now;
}
