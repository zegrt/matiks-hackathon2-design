import type { ReactNode } from 'react';
import { CHANNEL } from '../data/mock';
import { ageShort, bodyText, clock } from '../lib/format';
import { cohortText, isPinned, label, preview, type CohortFilter, type FilterKey, type Group, type Tab } from '../lib/tickets';
import { useApp, useNow } from '../state';
import type { Ticket } from '../types';
import { filterLabel } from './overlays/FilterPopover';

const TABS: [Exclude<Tab, 'agent'>, string][] = [['review', 'To review'], ['replied', 'Replied'], ['closed', 'Closed']];
const SEG: [CohortFilter, ReactNode][] = [['all', 'All'], ['paying', 'Paying'], ['streak', <>100+<span className="pw"> streak</span></>]];

export function Queue() {
  const { s, d, groups, counts: c, open } = useApp();
  const fs = Object.entries(s.filters) as [FilterKey, string[]][];
  const nf = fs.reduce((a, [, x]) => a + x.length, 0);
  return (
    <section className="q">
      <div className="tabs">{TABS.map(([k, l]) =>
        <button key={k} className={s.tab === k ? 'on' : ''} onClick={() => d({ type: 'tab', tab: k })}><b>{c[k]}</b>{l}</button>)}</div>
      <div className="frow">
        <div className="seg">{SEG.map(([k, l]) =>
          <button key={k} className={s.cohort === k ? 'on' : ''} onClick={() => d({ type: 'cohort', cohort: k })} title={k === 'streak' ? '100+ day streak' : undefined}>{l}</button>)}</div>
        <button className={`fbtn ${nf ? 'on' : ''}`} data-anchor="filter" onClick={e => open('filter', e.currentTarget)}>Filter{nf ? <em>{nf}</em> : null}</button>
      </div>
      {nf > 0 && (
        <div className="chips">
          {fs.flatMap(([k, vs]) => vs.map(v =>
            <span className="chip" key={k + v}>{filterLabel(v)}<button onClick={() => d({ type: 'toggleFilter', key: k, value: v })} aria-label="Remove">×</button></span>))}
          <button className="chip" onClick={() => d({ type: 'clearFilters' })} style={{ paddingRight: 8 }}>Clear</button>
        </div>
      )}
      <div className="list">
        {groups.length ? groups.map(g => <GroupRows key={g.key} g={g} />) : <div className="empty"><b>Nothing here</b>{emptyWhy()}</div>}
      </div>
      <button className={`agentq ${s.tab === 'agent' ? 'on' : ''}`} onClick={() => d({ type: 'tab', tab: 'agent' })}>
        <span className="spin" />Agent working on {c.running}{c.failed ? <span className="failn">· {c.failed} failed</span> : null}<span className="go">›</span>
      </button>
    </section>
  );

  function emptyWhy() {
    if (s.cohort === 'paying') return 'No paying users are waiting. Only 57 users have an active subscription, so this list is often empty.';
    if (s.cohort === 'streak') return 'No one with a 100+ day streak is waiting.';
    if (nf) return 'No tickets match these filters.';
    return s.tab === 'review' ? 'Every ticket has been handled.' : 'No tickets yet.';
  }
}

function GroupRows({ g }: { g: Group }) {
  const { s, d, open } = useApp();
  const aside = g.key === 'auto' ? <button className="aside" onClick={() => open('approveAll')}>Approve all · ⇧A</button>
    : g.key === 'off' ? <button className="aside" onClick={() => d({ type: 'toggleShowOff' })}>{s.showOff ? 'Hide' : 'Show'}</button>
    : <span className="aside">{g.aside || ''}</span>;
  return (
    <>
      <div className={`grp ${g.key === 'crit' || g.key === 'fail' ? 'crit' : ''}`}><span>{g.title} · {g.items.length}</span>{aside}</div>
      {(g.key !== 'off' || s.showOff) && g.items.map(t => <Row key={t.id} t={t} />)}
    </>
  );
}

function Row({ t }: { t: Ticket }) {
  const { s, d } = useApp();
  const sel = t.id === s.sel, pin = isPinned(t), ct = cohortText(t);
  const cls = ['row', t.mode === 'escalate' && !t.handedOff && t.status === 'triaged' ? 'esc' : '', pin ? 'crit' : '', sel ? 'sel' : '', t.isNew ? 'new' : ''].join(' ');
  const state = t.status === 'open' ? (t.run.status === 'failed' ? <span className="e">Agent failed</span> : <span>{t.run.steps.find(x => x.status === 'now')?.step || 'queued'}…</span>)
    : t.handedOff ? <span>→ {t.handedOff.to}</span>
    : t.rejected ? <span>Draft rejected</span>
    : t.status === 'triaged' && t.mode === 'escalate' ? <span className="e">Escalate</span>
    : t.status === 'triaged' && t.mode === 'auto' ? <span className="a">Auto {t.confidence?.toFixed(2)}</span>
    : null;
  return (
    <button className={cls} onClick={() => d({ type: 'select', id: t.id })}>
      <span className="r1"><b>{pin ? <><span className="sev"><span className="pdot" />Safety</span>{label(t)}</> : label(t)}</b>{!sel && <span className="age">{ageShort(t.ageMin)}</span>}</span>
      <span className="prev">{bodyText(preview(t), s.mask)}</span>
      <span className="meta">{ct && <span className="co">{ct}</span>}{state}{sel ? <OnIt since={s.onSince} /> : <span className="ch">{CHANNEL[t.channel]}</span>}</span>
    </button>
  );
}

/** Its own component so only this span re-renders every second. */
function OnIt({ since }: { since: number }) {
  const now = useNow();
  return <span className="ch on-it"><i />{clock(now - since)} on it</span>;
}
