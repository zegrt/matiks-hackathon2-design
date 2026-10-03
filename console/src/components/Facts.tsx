// Facts column: who the user is, priority, evidence or why-escalated, the decision, and the pipeline trace line.
import { maskValue, money } from '../lib/format';
import { isPinned, prioParts, rankOf, whoKey } from '../lib/tickets';
import { useApp } from '../state';
import type { Ticket } from '../types';

export function Facts({ t }: { t: Ticket }) {
  const { s, d, order, open } = useApp();
  const c = t.cohort, triaged = t.status === 'triaged';

  function prio() {
    if (isPinned(t)) return (
      <div className="prio"><div className="h"><span><b className="r">Pinned</b> · priority score</span><span className="n">{t.score}</span></div>
        <div className="pinned">Score alone would put it at <b>#{rankOf(s.tickets, t)}</b>. Safety reports are pinned above the ranking.</div></div>
    );
    const rank = order.indexOf(t.id) + 1 || '–';
    if (!t.score) return (
      <div className="prio"><div className="h"><span><b>#{rank}</b> · priority score</span><span className="n">0</span></div>
        <div className="pinned" style={{ color: 'var(--tx3)' }}>No priority group, so it’s ranked by wait time.</div></div>
    );
    const parts = prioParts(t);
    return (
      <div className="prio"><div className="h"><span><b>#{rank}</b> · priority score</span><span className="n">{t.score}</span></div>
        <div className="stack">{parts.map(([v, l, w]) => <i key={l} className={w ? 'w' : undefined} style={{ flex: v }} />)}</div>
        <div className="legend">{parts.map(([v, l]) => <span key={l}><b>+{v}</b> {l}</span>)}</div></div>
    );
  }

  function user() {
    const q100 = c.resolved && c.streak >= 100;
    const [key, kind] = whoKey(t);
    return (
      <div>
        <div className="uhead"><span className="lab">User</span>
          {c.resolved
            ? <span className="match">by {c.by} · looked up {c.lookedUpH ? c.lookedUpH + 'h ago' : 'just now'}</span>
            : <span className="match warn">no match</span>}</div>
        <div className="cells">
          <div className={'cell' + (q100 ? ' q' : '')}><div className="k">Streak {q100 && <span className="tag">100+</span>}</div><div className="v">{c.resolved ? <>{c.streak}<small>days</small></> : '—'}</div></div>
          <div className={'cell' + (c.resolved && c.paying ? ' q' : '')}><div className="k">Paying</div><div className="v">{c.resolved ? (c.paying ? 'Yes' : 'No') : '—'}</div></div>
        </div>
        {!c.resolved && (
          <div className="warnbox"><b>No account matches {maskValue(key, kind, s.mask)}.</b> {c.by === 'phone' ? 'Lookups work on email or username; this report only has a phone number.' : 'Cohort unknown, never “not paying”.'} The draft can’t use account facts.</div>
        )}
        {t.claim && triaged && <div className="warnbox"><b>Says {t.claim.said}{t.claim.what ? ' ' + t.claim.what : ' days'}.</b> The database shows {t.claim.db}; the draft uses {t.claim.db}.</div>}
        <div className="other"><span>Earlier tickets</span><b>{t.others ? '1 · Sep 12, closed' : 'None'}</b></div>
        {triaged && prio()}
      </div>
    );
  }

  function evidence() {
    const dr = t.draft;
    if (!dr) return null;
    return (
      <div className="ev"><span className="lab">Evidence · {dr.evidence.length}</span>{dr.evidence.map((e, i) => (
        <div key={i} className={'r' + (s.hot === i ? ' hot' : '')} onMouseEnter={() => d({ type: 'hot', i })} onMouseLeave={() => d({ type: 'hot', i: null })}>
          <span className="k">{e.fact}</span>
          {e.verified ? <span className="ver">verified</span> : dr.body.some(x => x[1] === i) ? <span className="ind">in draft</span> : <span />}
          <span className="src">{e.src}</span>
        </div>
      ))}</div>
    );
  }

  function why() {
    return (
      <div className="ev"><span className="lab">Why a person handles it</span>{(t.why ?? []).map((w, i) => (
        <div key={i} className="r"><span className="k">{w.k}</span>
          <span className="val" style={w.v === 'hard rule' ? { font: '500 11.5px Archivo', color: 'var(--tx2)' } : undefined}>{w.v}</span>
          <span className="src">{w.src}</span></div>
      ))}</div>
    );
  }

  function decision() {
    const dr = t.draft, auto = t.mode === 'auto';
    if (!dr) return null;
    return (
      <div className="dec"><span className="lab">Decision</span>
        <div className="line"><b>{auto ? 'Auto' : 'Assist'}</b><span className="n">{dr.confidence.toFixed(2)}</span></div>
        <div className="conf"><i style={{ width: `${dr.confidence * 100}%` }} /><u /></div>
        <div className="conflab"><span>confidence</span><span>auto needs 0.90</span></div>
        <div className="sugg">{auto ? <><b>On the auto-resolve list</b> and above 0.90. One key approves it.</>
          : dr.suggested ? <><b>Suggests:</b> {dr.suggested}</> : 'Not on the auto-resolve list, so a person approves.'}</div></div>
    );
  }

  function resolution() {
    const first = t.history.find(h => h.h);
    return (
      <div className="dec"><span className="lab">Resolution</span>
        <div className="line"><span style={{ color: 'var(--tx2)' }}>First human action</span><span className="n">+{first?.after || '–'}</span></div>
        <div className="line"><span style={{ color: 'var(--tx2)' }}>Cost</span><span className="n">{money(t.run.cost || 0)}</span></div>
        <div className="sugg" style={{ color: 'var(--tx3)' }}>Counted in time-to-first-action and cost per resolved ticket.</div></div>
    );
  }

  const r = t.run;
  const what = r.status === 'running' ? 'running…' : r.status === 'failed' ? <span style={{ color: 'var(--red)' }}>failed</span>
    : r.stoppedAt ? `stopped at ${r.stoppedAt}` : `${r.steps.length} steps`;

  return (
    <aside className="f">
      {user()}
      {triaged && (t.mode === 'escalate' && !t.draft ? why() : <>{evidence()}{decision()}</>)}
      {(t.status === 'replied' || t.status === 'closed') && resolution()}
      <button className="trace" onClick={() => open('trace')}>
        <span>Pipeline {r.version} · {what}{r.ms ? <> · <b>{(r.ms / 1000).toFixed(1)}s</b></> : ''}</span>
        <span><b>{r.cost ? money(r.cost) : ''}</b> ›</span>
      </button>
    </aside>
  );
}
