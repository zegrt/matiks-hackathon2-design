// The console's state machine: pure, no React. Every decision is applied here.
import type { ChannelHealth, EvalRow, Insights, Ticket } from './types';
import { groups, order, plain, type CohortFilter, type FilterKey, type Filters, type QueueQuery, type Tab } from './lib/tickets';

export type View = 'queue' | 'insights' | 'evals';
export type DialogKind = 'name' | 'reject' | 'handoff' | 'close' | 'note' | 'approveAll';
export type Overlay = null | DialogKind | 'palette' | 'filter' | 'channels' | 'more' | 'trace' | 'keys';
export interface Anchor { left: number; top: number; right: number; bottom: number }
export interface Toast { id: number; msg: string; undo?: Ticket[] }
export type Decision = 'approve' | 'save' | 'reject' | 'handoff' | 'close' | 'note' | 'reopen';

export interface State {
  loaded: boolean;
  tickets: Ticket[];
  channels: ChannelHealth[];
  insights: Insights | null;
  evals: EvalRow[];
  view: View;
  tab: Tab;
  cohort: CohortFilter;
  filters: Filters;
  showOff: boolean;
  sel: string | null;
  /** when the selected ticket was opened; drives the "on it" timer */
  onSince: number;
  editing: boolean;
  editText: string;
  showFull: boolean;
  /** evidence index hovered in the draft or the evidence list */
  hot: number | null;
  overlay: Overlay;
  anchor: Anchor | null;
  openStep: number | null;
  mask: boolean;
  offline: boolean;
  theme: 'light' | 'dark';
  actor: string | null;
  toast: Toast | null;
  icohort: CohortFilter;
  evalFails: boolean;
}

export type Action =
  | { type: 'loaded'; tickets: Ticket[]; channels: ChannelHealth[]; insights: Insights; evals: EvalRow[] }
  | { type: 'ticket'; ticket: Ticket }
  | { type: 'view'; view: View }
  | { type: 'tab'; tab: Tab }
  | { type: 'cohort'; cohort: CohortFilter }
  | { type: 'select'; id: string }
  | { type: 'move'; delta: 1 | -1 }
  | { type: 'toggleFilter'; key: FilterKey; value: string }
  | { type: 'clearFilters' }
  | { type: 'onlyFilter'; key: FilterKey; value: string }
  | { type: 'toggleShowOff' }
  | { type: 'toggleMask' }
  | { type: 'toggleOffline' }
  | { type: 'toggleTheme' }
  | { type: 'open'; overlay: Exclude<Overlay, null>; anchor?: Anchor | null }
  | { type: 'close' }
  | { type: 'edit'; blank: boolean }
  | { type: 'editText'; text: string }
  | { type: 'cancelEdit' }
  | { type: 'toggleFull' }
  | { type: 'hot'; i: number | null }
  | { type: 'openStep'; i: number }
  | { type: 'icohort'; cohort: CohortFilter }
  | { type: 'toggleEvalFails' }
  | { type: 'setActor'; name: string }
  | { type: 'decide'; kind: Decision; id: string; reason?: string; text?: string }
  | { type: 'approveAll' }
  | { type: 'undo' }
  | { type: 'toastDone'; id: number }
  | { type: 'goto'; id: string }
  | { type: 'notify'; msg: string };

const emptyFilters = (): Filters => ({ channel: [], category: [], mode: [], lang: [] });
export const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode: in-memory only */ } },
};

export function init(): State {
  const actor = store.get('dispatch.actor');
  const saved = store.get('dispatch.theme');
  const theme = saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return {
    loaded: false, tickets: [], channels: [], insights: null, evals: [],
    view: 'queue', tab: 'review', cohort: 'all', filters: emptyFilters(), showOff: false,
    sel: null, onSince: Date.now(), editing: false, editText: '', showFull: false, hot: null,
    overlay: actor ? null : 'name', anchor: null, openStep: null,
    mask: true, offline: false, theme, actor,
    toast: null, icohort: 'all', evalFails: false,
  };
}

export const queryOf = (s: State): QueueQuery => ({ tickets: s.tickets, tab: s.tab, cohort: s.cohort, filters: s.filters });
const orderOf = (s: State) => order(queryOf(s), s.showOff);

function withSel(s: State, id: string | null): State {
  if (id === s.sel) return s;
  return { ...s, sel: id, onSince: Date.now(), editing: false, editText: '', showFull: false, hot: null };
}
/** Keep a valid ticket selected in the queue. */
function fixSel(s: State): State {
  if (s.view !== 'queue' || !s.loaded) return s;
  const o = orderOf(s);
  return s.sel && o.includes(s.sel) ? s : withSel(s, o[0] ?? null);
}
/** After a decision removes a ticket from the list, open the one that was below it. */
function moveOn(s: State, id: string, before: string[]): State {
  const o = orderOf(s);
  if (o.includes(id)) return s;
  const next = before.slice(before.indexOf(id) + 1).find(x => o.includes(x)) ?? o[o.length - 1] ?? null;
  return withSel(s, next);
}
const toast = (msg: string, undo?: Ticket[]): Toast => ({ id: Date.now() + Math.random(), msg, undo });

function decide(s: State, a: Extract<Action, { type: 'decide' }>): State {
  const t = s.tickets.find(x => x.id === a.id);
  if (!t) return s;
  const who = s.actor || 'console';
  const before = orderOf(s);
  const mins = Math.max(1, Math.round((Date.now() - s.onSince) / 60000));
  const hist = (act: string) => [...t.history, { who, act, after: `${t.ageMin + mins}m`, h: true }];
  let nt: Ticket, msg: string, undoable = true, stay = false;
  switch (a.kind) {
    case 'approve':
      nt = { ...t, status: 'replied', final: plain(t) + ' — Team Matiks', history: hist(t.mode === 'auto' ? 'approved (auto)' : 'approved') };
      msg = 'Approved · moved to Replied · nothing sent'; break;
    case 'save': {
      const text = s.editText.trim(); if (!text) return s;
      const edited = !!t.draft && !t.rejected && t.mode !== 'escalate' && !t.handedOff;
      nt = { ...t, status: 'replied', final: text + ' — Team Matiks', history: hist(edited ? 'edited and approved' : 'wrote a reply') };
      msg = 'Reply saved · moved to Replied · nothing sent'; break;
    }
    case 'reject':
      nt = { ...t, rejected: { by: who, reason: [a.reason, a.text].filter(Boolean).join(' · ') }, history: hist('rejected the draft') };
      msg = 'Draft rejected · the ticket stays in To review'; stay = true; break;
    case 'handoff': {
      const to = t.draft?.routing || t.routing || 'the owning team';
      nt = { ...t, handedOff: { to, by: who, text: a.text }, history: hist(`handed off to ${to}`) };
      msg = `Handed off to ${to} · moved to Handed off`; break;
    }
    case 'close':
      nt = { ...t, status: 'closed', closedReason: a.reason, history: hist(`closed${a.reason ? ' · ' + a.reason.toLowerCase() : ''}`) };
      msg = 'Closed · nothing sent'; break;
    case 'note': {
      const text = a.text?.trim(); if (!text) return s;
      nt = { ...t, notes: [...(t.notes ?? []), { by: who, text }], history: hist('added a note') };
      msg = 'Note saved'; undoable = false; stay = true; break;
    }
    case 'reopen':
      nt = { ...t, status: t.issue ? 'triaged' : 'open', handedOff: null, history: hist('reopened') };
      msg = 'Reopened · back in To review'; break;
  }
  let n: State = { ...s, tickets: s.tickets.map(x => x.id === t.id ? nt : x), overlay: null, anchor: null,
    editing: false, editText: '', toast: toast(msg, undoable ? [t] : undefined) };
  if (a.kind === 'reopen') n = withSel({ ...n, tab: nt.status === 'open' ? 'agent' : 'review' }, t.id);
  else if (!stay) n = moveOn(n, t.id, before);
  return n;
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'loaded': return fixSel({ ...s, loaded: true, tickets: a.tickets, channels: a.channels, insights: a.insights, evals: a.evals });
    case 'ticket': {
      const exists = s.tickets.some(t => t.id === a.ticket.id);
      const tickets = exists ? s.tickets.map(t => t.id === a.ticket.id ? a.ticket : t) : [...s.tickets, a.ticket];
      const tab = s.sel === a.ticket.id && s.tab === 'agent' && a.ticket.status === 'triaged' ? 'review' : s.tab;
      return fixSel({ ...s, tickets, tab });
    }
    case 'view': return fixSel({ ...s, view: a.view, overlay: null, anchor: null });
    case 'tab': return fixSel({ ...s, tab: a.tab, showOff: false });
    case 'cohort': return fixSel({ ...s, cohort: a.cohort });
    case 'select': return withSel(s, a.id);
    case 'move': {
      const o = orderOf(s); if (!o.length) return s;
      const i = s.sel ? o.indexOf(s.sel) : -1;
      return withSel(s, o[Math.max(0, Math.min(o.length - 1, i + a.delta))]);
    }
    case 'toggleFilter': {
      const L = s.filters[a.key];
      return fixSel({ ...s, filters: { ...s.filters, [a.key]: L.includes(a.value) ? L.filter(v => v !== a.value) : [...L, a.value] } });
    }
    case 'clearFilters': return fixSel({ ...s, filters: emptyFilters() });
    case 'onlyFilter': return fixSel({ ...s, view: 'queue', tab: 'review', cohort: 'all', filters: { ...emptyFilters(), [a.key]: [a.value] } });
    case 'toggleShowOff': return fixSel({ ...s, showOff: !s.showOff });
    case 'toggleMask': return { ...s, mask: !s.mask };
    case 'toggleOffline': return { ...s, offline: !s.offline };
    case 'toggleTheme': return { ...s, theme: s.theme === 'dark' ? 'light' : 'dark' };
    case 'open': return { ...s, overlay: a.overlay, anchor: a.anchor ?? null, openStep: a.overlay === 'trace' ? null : s.openStep };
    case 'close': return s.overlay === 'name' && !s.actor ? s : { ...s, overlay: null, anchor: null, openStep: null };
    case 'edit': {
      const t = s.tickets.find(x => x.id === s.sel);
      return t ? { ...s, editing: true, editText: a.blank ? '' : plain(t) } : s;
    }
    case 'editText': return { ...s, editText: a.text };
    case 'cancelEdit': return { ...s, editing: false, editText: '' };
    case 'toggleFull': return { ...s, showFull: !s.showFull };
    case 'hot': return s.hot === a.i ? s : { ...s, hot: a.i };
    case 'openStep': return { ...s, openStep: s.openStep === a.i ? null : a.i };
    case 'icohort': return { ...s, icohort: a.cohort };
    case 'toggleEvalFails': return { ...s, evalFails: !s.evalFails };
    case 'setActor': return a.name.trim() ? { ...s, actor: a.name.trim(), overlay: null } : s;
    case 'decide': return decide(s, a);
    case 'approveAll': {
      const auto = groups(queryOf(s)).find(g => g.key === 'auto')?.items ?? [];
      if (!auto.length) return s;
      const before = orderOf(s), ids = new Set(auto.map(t => t.id)), who = s.actor || 'console';
      const tickets = s.tickets.map(t => !ids.has(t.id) ? t : { ...t, status: 'replied' as const, final: plain(t) + ' — Team Matiks',
        history: [...t.history, { who, act: 'approved (auto batch)', after: `${t.ageMin + 1}m`, h: true }] });
      let n: State = { ...s, tickets, overlay: null, anchor: null,
        toast: toast(`Approved ${auto.length} auto-ready repl${auto.length === 1 ? 'y' : 'ies'} · nothing sent`, auto) };
      if (s.sel && ids.has(s.sel)) n = moveOn(n, s.sel, before);
      return n;
    }
    case 'undo': {
      const back = s.toast?.undo; if (!back?.length) return s;
      const byId = new Map(back.map(t => [t.id, t]));
      const first = back[0];
      const tab: Tab = first.status === 'triaged' ? 'review' : first.status === 'open' ? 'agent' : first.status;
      return withSel({ ...s, tickets: s.tickets.map(t => byId.get(t.id) ?? t), tab, showOff: !!first.handedOff || s.showOff,
        toast: toast('Undone · recorded as a reopen') }, first.id);
    }
    case 'toastDone': return s.toast?.id === a.id ? { ...s, toast: null } : s;
    case 'notify': return { ...s, toast: toast(a.msg) };
    case 'goto': {
      const t = s.tickets.find(x => x.id === a.id); if (!t) return s;
      const tab: Tab = t.status === 'triaged' ? 'review' : t.status === 'open' ? 'agent' : t.status;
      return withSel({ ...s, view: 'queue', tab, cohort: 'all', filters: emptyFilters(), showOff: !!t.handedOff, overlay: null, anchor: null }, t.id);
    }
  }
}

