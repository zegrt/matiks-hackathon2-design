// Evals page. Port of the prototype's evalsHTML().
import { useApp } from '../state';
import { money } from '../lib/format';
import type { EvalRow } from '../types';

const failed = (r: EvalRow) => r.expected !== r.actual || !r.said || !r.notSaid;
const Ck = ({ ok }: { ok: boolean }) => ok ? <span className="pass">✓</span> : <span className="fail">✗</span>;

export function Evals() {
  const { s, d } = useApp();
  const rows = s.evals, n = rows.length;
  const modeOk = rows.filter(r => r.expected === r.actual).length;
  const saidOk = rows.filter(r => r.said).length, notOk = rows.filter(r => r.notSaid).length;
  const mustEsc = rows.filter(r => r.expected === 'escalate'), escOk = mustEsc.filter(r => r.actual === 'escalate').length;
  const avg = rows.reduce((a, r) => a + r.cost, 0) / n;
  const shown = s.evalFails ? rows.filter(failed) : rows;

  return (
    <section className="page"><div className="inner">
      <div className="phd"><div><h1>Evals <span className="sample">sample data</span></h1><p>30 hand-labelled tickets from <span className="mono">knowledge-base/evals/tickets.yaml</span>, run on pipeline v0.3. Where results are stored is still an open question for the devs.</p></div>
        <button className={`fbtn ${s.evalFails ? 'on' : ''}`} onClick={() => d({ type: 'toggleEvalFails' })}>{s.evalFails ? 'Showing failures' : 'Show failures only'}</button></div>
      <div className="kpis">
        <div className="kpi"><div className="k">Mode accuracy</div><div className="v">{modeOk}<small>of {n}</small></div><div className="s">auto / assist / escalate as labelled</div></div>
        <div className="kpi"><div className="k">Must-escalate caught</div><div className="v">{escOk}<small>of {mustEsc.length}</small></div><div className="s">safety, payments, merch, deletion, lost streaks</div></div>
        <div className="kpi"><div className="k">Fact compliance</div><div className="v">{Math.min(saidOk, notOk)}<small>of {n}</small></div><div className="s">must-say {saidOk}/{n} · must-not-say {notOk}/{n}</div></div>
        <div className="kpi"><div className="k">Cost per ticket</div><div className="v">{money(avg)}</div><div className="s">escalations stop before drafting</div></div>
      </div>
      <table className="tbl"><thead><tr><th>#</th><th>Ticket</th><th>Expected leaf</th><th>Expected</th><th>Got</th><th>Must say</th><th>Must not say</th><th style={{ textAlign: 'right' }}>Cost</th></tr></thead>
        <tbody>{shown.map(r => (
          <tr key={r.n} className={failed(r) ? 'fl' : ''}><td className="mono">{r.n}</td><td>{r.text}</td><td className="mono">{r.leaf}</td><td>{r.expected}</td>
            <td>{r.expected === r.actual ? r.actual : <span className="fail">{r.actual}</span>}</td><td><Ck ok={r.said} /></td><td><Ck ok={r.notSaid} /></td>
            <td className="mono" style={{ textAlign: 'right' }}>{money(r.cost)}</td></tr>
        ))}</tbody></table>
    </div></section>
  );
}
