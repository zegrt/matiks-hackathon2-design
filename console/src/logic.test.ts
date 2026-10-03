// Run: npm test. Covers the logic a wrong answer would hurt: ranking, grouping, checks, masking, decisions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICKETS, score } from './data/mock';
import { checks, groups, type QueueQuery } from './lib/tickets';
import { maskValue } from './lib/format';
import { reducer, type State } from './reducer';

const base = (): State => ({
  loaded: true, tickets: structuredClone(TICKETS), channels: [], insights: null, evals: [],
  view: 'queue', tab: 'review', cohort: 'all', filters: { channel: [], category: [], mode: [], lang: [] }, showOff: false,
  sel: 't2', onSince: Date.now(), editing: false, editText: '', showFull: false, hot: null,
  overlay: null, anchor: null, openStep: null, mask: true, offline: false, theme: 'dark', actor: 'Cyril',
  toast: null, icohort: 'all', evalFails: false,
});
const q = (s: State): QueueQuery => ({ tickets: s.tickets, tab: s.tab, cohort: s.cohort, filters: s.filters });
const tk = (s: State, id: string) => s.tickets.find(t => t.id === id)!;

test('priority_score matches the ingest formula; unmatched users score 0', () => {
  assert.equal(score({ resolved: true, by: 'username', paying: true, streak: 118, lookedUpH: 0 }), 311);
  assert.equal(score({ resolved: true, by: 'username', paying: false, streak: 140, lookedUpH: 0 }), 114);
  assert.equal(score({ resolved: true, by: 'username', paying: false, streak: 2000, lookedUpH: 0 }), 199); // streak/10 caps at 99
  assert.equal(score({ resolved: false, by: 'email', paying: true, streak: 500, lookedUpH: 0 }), 0);
});

test('safety escalations are pinned above the score; auto-ready drafts get their own group', () => {
  const gs = groups(q(base()));
  assert.deepEqual(gs.map(g => g.key), ['crit', 'prio', 'auto']);
  assert.equal(gs[0].items[0].id, 't1');            // score 1, still first
  assert.equal(gs[1].items[0].id, 't2');            // 311, top of the ranked list
  assert.ok(gs[2].items.every(t => t.mode === 'auto'));
});

test('editor checks flag numbers missing from evidence and promises', () => {
  const t8 = TICKETS.find(t => t.id === 't8')!;
  const [nums, , promise] = checks(t8, 'Aapki rating 38 points giri. Aapko 40 wapas milenge, will be fixed by tomorrow.');
  assert.equal(nums.tone, 'w'); assert.match(nums.text, /40 not in the evidence/);
  assert.equal(promise.tone, 'w');
  assert.equal(checks(t8, 'Aapki rating 38 points giri thi.')[0].tone, 'g');
});

test('PII masking', () => {
  assert.equal(maskValue('ankit.k07', 'user', true), 'an••••07');
  assert.equal(maskValue('meera.s@yahoo.in', 'email', true), 'm•••@y•••.in');
  assert.equal(maskValue('+91 98765 43471', 'phone', true), '••••• ••471');
  assert.equal(maskValue('ankit.k07', 'user', false), 'ankit.k07');
});

test('approve moves the ticket to replied, opens the next one, and undo restores it', () => {
  let s = reducer(base(), { type: 'decide', kind: 'approve', id: 't2' });
  assert.equal(tk(s, 't2').status, 'replied');
  assert.equal(s.sel, 't3');                         // the ticket below it
  assert.ok(s.toast?.undo);
  s = reducer(s, { type: 'undo' });
  assert.equal(tk(s, 't2').status, 'triaged');
  assert.equal(s.sel, 't2');
});

test('reject and note keep the status; hand-off leaves the list; empty notes are ignored', () => {
  let s = reducer(base(), { type: 'decide', kind: 'reject', id: 't2', reason: 'Wrong facts' });
  assert.equal(tk(s, 't2').status, 'triaged'); assert.equal(tk(s, 't2').rejected?.reason, 'Wrong facts'); assert.equal(s.sel, 't2');
  const before = s;
  assert.equal(reducer(s, { type: 'decide', kind: 'note', id: 't2', text: '   ' }), before);
  s = reducer({ ...s, sel: 't3' }, { type: 'decide', kind: 'handoff', id: 't3' });
  assert.equal(tk(s, 't3').handedOff?.to, 'Payments');
  assert.ok(!groups(q(s)).find(g => g.key === 'prio')!.items.some(t => t.id === 't3'));
});

test('approve all clears the auto-ready group in one action', () => {
  const s = reducer(base(), { type: 'approveAll' });
  assert.ok(!groups(q(s)).some(g => g.key === 'auto'));
  assert.equal(s.toast?.undo?.length, 2);
});
