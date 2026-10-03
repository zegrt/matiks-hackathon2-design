// Pipeline trace drawer: one row per agent_runs.trace step, joined with its token_log rows.
import { cap, money } from '../lib/format';
import { useApp } from '../state';
import type { Ticket } from '../types';
import { Btn } from './ui';

export function TraceDrawer({ t }: { t: Ticket }) {
  const { s, d } = useApp();
  const r = t.run, steps = r.steps, mx = Math.max(...steps.map(x => x.ms || 0), 1);
  const tokIn = steps.reduce((a, x) => a + (x.inTok || 0), 0), tokOut = steps.reduce((a, x) => a + (x.outTok || 0), 0);
  const calls = steps.filter(x => x.model && x.model !== 'tools' && x.inTok).length;
  return (
    <aside className="drawer">
      <header>
        <div><h5 style={{ font: '600 16px Archivo' }}>Pipeline run</h5>
          <p className="sm"><span className="mono">{r.version}</span> · {t.ext} · {r.status}{r.stoppedAt ? ' · stopped at ' + r.stoppedAt : ''}</p></div>
        <Btn k="Esc" className="quiet" onClick={() => d({ type: 'close' })}>Close</Btn>
      </header>
      <div className="body">
        <div className="sum">
          <div>Time<b>{r.ms ? (r.ms / 1000).toFixed(1) + 's' : '–'}</b></div>
          <div>Cost<b>{r.cost ? money(r.cost) : '–'}</b></div>
          <div>Tokens in / out<b>{tokIn.toLocaleString()} / {tokOut}</b></div>
          <div>Model calls<b>{calls}</b></div>
        </div>
        {steps.map((x, i) => (
          <div key={i} className={'step' + (x.status === 'fail' ? ' fail' : '')}>
            <button onClick={() => d({ type: 'openStep', i })}>
              <span className="ix">{String(i + 1).padStart(2, '0')}</span>
              <span className="nm">{cap(x.step)}<small>{x.model}</small></span>
              <span className="ms">{x.status === 'now' ? 'running…' : x.status === 'fail' ? 'failed' : x.ms + ' ms'}</span>
              <span className="co">{x.cost ? money(x.cost) : x.model === 'tools' ? 'no LLM' : ''}</span>
            </button>
            {x.ms ? <div className="tb"><i style={{ width: `${x.ms / mx * 100}%` }} /></div> : null}
            {s.openStep === i && (
              <pre>{`input   ${x.input || '(not recorded)'}\noutput  ${x.output || '(not recorded)'}${x.inTok ? `\ntokens  ${x.inTok} in · ${x.outTok} out` : ''}`}</pre>
            )}
            {x.status === 'fail' && <pre style={{ borderColor: 'var(--red-edge)' }}>{r.error}</pre>}
          </div>
        ))}
        <p className="sm" style={{ marginTop: 14 }}>Each row is one step from <span className="mono">agent_runs.trace</span>, joined with its <span className="mono">token_log</span> rows. Click a step for its input and output.</p>
      </div>
    </aside>
  );
}
