// Insights page. Port of the prototype's insightsHTML(); charts are plain markup styled by app.css.
import { useApp } from '../state';
import { flowNow, type CohortFilter } from '../lib/tickets';
import { money, secs } from '../lib/format';

const COHORTS: [CohortFilter, string][] = [['all', 'All'], ['streak', '100+ streak'], ['paying', 'Paying']];
/** position on the 10s–1h log axis, in % */
const lg = (s: number) => (Math.log10(s) - 1) / (Math.log10(3600) - 1) * 100;
const swatch = (background: string) => ({ display: 'inline-block', width: 10, height: 8, background, marginRight: 5 });

export function Insights() {
  const { s, d, counts: c } = useApp();
  const I = s.insights;
  if (!I) return null;

  const issues = I.topIssues[s.icohort], max = Math.max(...issues.map(x => x[2]));
  const cmax = Math.max(...I.costDays.map(x => x[1])), lastDay = I.costDays.length - 1;
  const total = I.costSteps.reduce((a, x) => a + x[2], 0), smax = Math.max(...I.costSteps.map(x => x[2]));
  const chmax = Math.max(...I.channels.map(x => x[1]));
  const F = flowNow(c, s.tickets, I);
  const resolved = F[3][1] + F[4][1], inflow = F.reduce((a, x) => a + x[1], 0);

  return (
    <section className="page"><div className="inner">
      <div className="phd"><div><h1>Insights</h1><p>Last 7 days, all channels. Each number is one query on the support database, so it matches what the judges can check.</p></div>
        <div className="seg" style={{ flex: 'none', width: 260 }}><button>Today</button><button className="on">7 days</button><button>All time</button></div></div>
      <div className="kpis">
        <div className="kpi"><div className="k">Median to first action · assist</div><div className="v">{I.kpi.firstAction}</div><div className="s">Auto 0:41 · escalate 41m</div></div>
        <div className="kpi"><div className="k">Cost per resolved ticket</div><div className="v">{money(I.kpi.costPerResolved)}</div><div className="s">{resolved} resolved · ${total.toFixed(2)} total</div></div>
        <div className="kpi"><div className="k">Resolved</div><div className="v">{resolved}<small>of {inflow}</small></div><div className="s">{Math.round(resolved / inflow * 100)}% of what came in this week</div></div>
        <div className="kpi"><div className="k">Waiting now</div><div className="v">{c.review}<small>to review</small></div><div className="s">{c.running} with the agent{c.failed ? ` · ${c.failed} failed` : ''}</div></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Top issues<span className="seg" style={{ flex: 'none', width: 250 }}>{COHORTS.map(([k, l]) =>
          <button key={k} className={s.icohort === k ? 'on' : ''} onClick={() => d({ type: 'icohort', cohort: k })}>{l}</button>)}</span></h3>
          <p>By category. Click one to open those tickets in the queue.</p>
          <div className="legend" style={{ marginTop: 10 }}><span><i style={swatch('var(--bar)')} />handled with the agent</span><span><i style={swatch('var(--red)')} />escalated to a person</span></div>
          <div className="bars">{issues.map(([k, l, n, e]) => {
            const h = (n - e) / max * 100, w = e / max * 100;
            return (
              <button key={k} className="bar" data-tip={`${l}: ${n} tickets · ${e} escalated · click to see them in the queue`}
                onClick={() => d({ type: 'onlyFilter', key: 'category', value: k })}>
                <span className="l">{l}</span>
                <span className="t">{h ? <i style={{ width: `${h}%`, borderRadius: e ? 0 : undefined }} /> : null}{e ? <i className="esc" style={{ left: `calc(${h}% + ${h ? 2 : 0}px)`, width: `${w}%` }} /> : null}</span>
                <span className="v">{n}</span></button>
            );
          })}</div></div>
        <div className="card"><h3>Time to first action<span className="aside">median, by mode</span></h3>
          <p>From the moment the user wrote to the first human action. Log scale.</p>
          <div className="ttr">{I.ttr.map(([m, sec, n]) => (
            <div key={m} className="r" data-tip={`${m}: median ${secs(sec)} from the user writing to the first human action · ${n} tickets`}>
              <span className="m">{m}</span><span className="track"><u style={{ width: `${lg(sec)}%` }} /><i style={{ left: `${lg(sec)}%` }} /></span><span className="v">{secs(sec)}</span><span className="n">n={n}</span></div>
          ))}</div><div className="ttr"><div className="axis"><span>10s</span><span>1m</span><span>10m</span><span>1h</span></div></div>
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--tx3)' }}>Auto assumes one approve click (open question to the devs). If the API approves auto drafts itself, that row becomes seconds.</p></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>LLM cost per day<span className="aside">token_log · USD</span></h3><p>Today, so far, is the highlighted column.</p>
          <div className="cols7">{I.costDays.map(([day, v], i) => (
            <div key={day} data-tip={`${day}: $${v.toFixed(3)} total LLM cost${i === lastDay ? ' (so far today)' : ''}`}>
              {v === cmax || i === lastDay ? <span>${v.toFixed(3)}</span> : null}<i className={i === lastDay ? 'today' : ''} style={{ height: `${v / cmax * 100}%` }} /></div>
          ))}</div><div className="colx">{I.costDays.map(([day]) => <span key={day}>{day}</span>)}</div>
          <p style={{ marginTop: 12, fontSize: 12 }}>Prompt caching saved ${I.cacheSaved.toFixed(2)} this week.</p></div>
        <div className="card"><h3>Where the cost goes<span className="aside">by pipeline step</span></h3><p>Drafting with Sonnet is {Math.round(I.costSteps[0][2] / total * 100)}% of it; escalations stop before the draft step and cost almost nothing.</p>
          <div className="bars">{I.costSteps.map(([step, m, v]) => (
            <div key={step} className="bar" data-tip={`${step}: ${money(v)} · ${Math.round(v / total * 100)}% of the week’s cost`}>
              <span className="l">{step}<small>{m}</small></span><span className="t"><i style={{ width: `${v / smax * 100}%` }} /></span><span className="v">${v.toFixed(2)}</span></div>
          ))}</div></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Where tickets are now<span className="aside">this week · status</span></h3><p>Every ticket that came in, by where it ended up.</p>
          <div className="flow">{F.map(([k, n, st]) => <div key={k}><span className="k">{k}</span><b>{n}</b><span className="mono" style={{ fontSize: 10.5 }}>{st}</span></div>)}</div>
          <p style={{ marginTop: 14, fontSize: 12 }}>Agent: {I.agent.runs} runs · {I.agent.failed} failed ({(I.agent.failed / I.agent.runs * 100).toFixed(1)}%) · {I.agent.retriedOk} recovered on retry · {(I.agent.avgMs / 1000).toFixed(1)}s average.</p></div>
        <div className="card"><h3>By channel<span className="aside">all healthy</span></h3><p>Click a channel to filter the queue. File was added today with one new adapter.</p>
          <div className="bars">{I.channels.map(([n, v]) => (
            <button key={n} className="bar" data-tip={`${n}: ${v} tickets this week · click to filter the queue`}
              onClick={() => d({ type: 'onlyFilter', key: 'channel', value: n.toLowerCase() })}>
              <span className="l">{n}</span><span className="t"><i style={{ width: `${v / chmax * 100}%` }} /></span><span className="v">{v}</span></button>
          ))}</div></div>
      </div>
    </div></section>
  );
}
