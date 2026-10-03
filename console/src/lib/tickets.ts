// Pure queue and ticket logic. No React here.
import { LEAF } from '../data/mock';
import type { Insights, Ticket } from '../types';
import type { PiiKind } from './format';

export type Tab = 'review' | 'replied' | 'closed' | 'agent';
export type CohortFilter = 'all' | 'paying' | 'streak';
export type FilterKey = 'channel' | 'category' | 'mode' | 'lang';
export type Filters = Record<FilterKey, string[]>;
export interface QueueQuery { tickets: Ticket[]; tab: Tab; cohort: CohortFilter; filters: Filters }

export type GroupKey = 'crit' | 'prio' | 'auto' | 'off' | 'run' | 'fail' | 'replied' | 'closed';
export interface Group { key: GroupKey; title: string; items: Ticket[]; aside?: string }

export const cat = (t: Ticket) => (t.issue || '').split('.')[0];
export const label = (t: Ticket) => t.issue ? LEAF[t.issue] ?? t.issue : `Untriaged${t.hint ? ' · ' + t.hint : ''}`;
export const preview = (t: Ticket) => t.subject || t.body[0];
/** Safety escalations are pinned above priority_score, which has no severity component. */
export const isPinned = (t: Ticket) => t.status === 'triaged' && t.mode === 'escalate' && (t.issue || '').startsWith('safety.') && !t.handedOff;
const isAutoReady = (t: Ticket) => t.mode === 'auto' && !t.rejected;
export const byPrio = (a: Ticket, b: Ticket) => b.score - a.score || b.ageMin - a.ageMin;

export const whoKey = (t: Ticket): [string, PiiKind] =>
  t.reporter.username ? [t.reporter.username, 'user'] : t.reporter.email ? [t.reporter.email, 'email'] : [t.reporter.phone ?? '', 'phone'];

export function cohortText(t: Ticket) {
  if (!t.cohort.resolved) return 'Unmatched';
  return [t.cohort.paying && 'Paying', t.cohort.streak >= 100 && `${t.cohort.streak}d streak`].filter(Boolean).join(' · ');
}

export function passes(t: Ticket, q: QueueQuery) {
  const c = t.cohort, f = q.filters;
  if (q.cohort === 'paying' && !(c.resolved && c.paying)) return false;
  if (q.cohort === 'streak' && !(c.resolved && c.streak >= 100)) return false;
  if (f.channel.length && !f.channel.includes(t.channel)) return false;
  if (f.category.length && !f.category.includes(cat(t))) return false;
  if (f.mode.length && !f.mode.includes(t.mode ?? '')) return false;
  if (f.lang.length && !f.lang.includes(t.lang ?? '')) return false;
  return true;
}

export function groups(q: QueueQuery): Group[] {
  const pick = (fn: (t: Ticket) => boolean) => q.tickets.filter(t => fn(t) && passes(t, q));
  let gs: Group[];
  if (q.tab === 'review') {
    const all = pick(t => t.status === 'triaged');
    const live = all.filter(t => !t.handedOff);
    gs = [
      { key: 'crit', title: 'Critical', items: live.filter(isPinned).sort(byPrio), aside: 'pinned' },
      { key: 'prio', title: 'By priority', items: live.filter(t => !isPinned(t) && !isAutoReady(t)).sort(byPrio), aside: 'score, then oldest' },
      { key: 'auto', title: 'Auto-ready', items: live.filter(isAutoReady).sort(byPrio) },
      { key: 'off', title: 'Handed off', items: all.filter(t => t.handedOff).sort(byPrio) },
    ];
  } else if (q.tab === 'agent') {
    const open = pick(t => t.status === 'open');
    gs = [
      { key: 'run', title: 'Working', items: open.filter(t => t.run.status === 'running') },
      { key: 'fail', title: 'Failed · retrying', items: open.filter(t => t.run.status === 'failed') },
    ];
  } else {
    gs = [{ key: q.tab, title: 'Most recent first', items: pick(t => t.status === q.tab).sort((a, b) => a.ageMin - b.ageMin) }];
  }
  return gs.filter(g => g.items.length);
}

/** Ticket ids in display order — what J/K walks through. */
export const order = (q: QueueQuery, showOff: boolean) =>
  groups(q).flatMap(g => g.key === 'off' && !showOff ? [] : g.items).map(t => t.id);

export const counts = (tickets: Ticket[]) => ({
  review: tickets.filter(t => t.status === 'triaged' && !t.handedOff).length,
  replied: tickets.filter(t => t.status === 'replied').length,
  closed: tickets.filter(t => t.status === 'closed').length,
  running: tickets.filter(t => t.status === 'open' && t.run.status === 'running').length,
  failed: tickets.filter(t => t.status === 'open' && t.run.status === 'failed').length,
});
export type Counts = ReturnType<typeof counts>;

/** Where priority_score alone would place this ticket. */
export const rankOf = (tickets: Ticket[], t: Ticket) =>
  tickets.filter(x => x.status === 'triaged' && !x.handedOff).sort(byPrio).findIndex(x => x.id === t.id) + 1;

/** priority_score broken into its parts: [points, label, muted?] */
export function prioParts(t: Ticket): [number, string, boolean][] {
  const c = t.cohort;
  if (!c.resolved) return [];
  const tenth = Math.min(Math.floor(c.streak / 10), 99);
  const parts: [number, string, boolean][] = [];
  if (c.paying) parts.push([200, 'paying', false]);
  if (c.streak >= 100) parts.push([100, '100+ streak', false]);
  if (tenth) parts.push([tenth, 'streak ÷ 10', true]);
  return parts;
}

export const plain = (t: Ticket) => t.draft ? t.draft.body.map(s => s[0]).join('') : '';
export const isOldestTriaged = (tickets: Ticket[], t: Ticket) =>
  t.ageMin === Math.max(...tickets.filter(x => x.status === 'triaged').map(x => x.ageMin));

export interface Check { tone: 'g' | 'w' | ''; text: string }
/** The editor's live checks: numbers vs evidence, the 5-sentence rule, promise words. */
export function checks(t: Ticket, text: string): Check[] {
  const ok = new Set<string>();
  (t.draft?.evidence ?? []).forEach(e => {
    (e.values ?? []).forEach(v => ok.add(v));
    (e.fact.match(/\d+(\.\d+)?/g) ?? []).forEach(v => ok.add(v));
  });
  const nums = [...new Set(text.match(/\d+(\.\d+)?/g) ?? [])];
  const bad = nums.filter(n => !ok.has(n));
  const sentences = text.split(/[.!?।]+(?:\s|$)/).filter(s => s.trim().length > 1).length;
  return [
    !nums.length ? { tone: '', text: 'No numbers to check' }
      : bad.length ? { tone: 'w', text: `▲ ${bad.join(', ')} not in the evidence` }
      : { tone: 'g', text: `✓ ${nums.length} number${nums.length > 1 ? 's' : ''} match evidence` },
    sentences <= 5 ? { tone: 'g', text: `✓ ${sentences} of 5 sentences` } : { tone: 'w', text: `▲ ${sentences} sentences · the style guide allows 5` },
    /\b(will be fixed|refund will|by tomorrow|guarantee)/i.test(text)
      ? { tone: 'w', text: '▲ Sounds like a promise · the style guide forbids dates and refunds' }
      : { tone: 'g', text: '✓ No promises' },
  ];
}

/** Insights status flow: weekly base + the tickets currently loaded, so it always matches the queue. */
export function flowNow(c: Counts, tickets: Ticket[], ins: Insights): [string, number, string][] {
  const off = tickets.filter(t => t.status === 'triaged' && t.handedOff).length;
  return [
    ['With the agent', c.running + c.failed, 'open'],
    ['To review', c.review, 'triaged'],
    ['Handed off', ins.flowBase.handed + off, 'triaged + escalate'],
    ['Replied', ins.flowBase.replied + c.replied, 'replied'],
    ['Closed', ins.flowBase.closed + c.closed, 'closed'],
  ];
}
