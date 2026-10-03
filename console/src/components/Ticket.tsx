// Ticket pane: header, inbound message, draft / editor / agent state / history, and the action row.
import { Fragment, type ReactNode } from 'react';
import { CHANNEL, LANG } from '../data/mock';
import { ageLong, cap, received, waitBig } from '../lib/format';
import { cat, checks, isOldestTriaged, isPinned, label, whoKey } from '../lib/tickets';
import { useApp } from '../state';
import type { Ticket } from '../types';
import { Body, Btn, Pii, Who } from './ui';

/** Put the caret at the end when the editor mounts (autoFocus puts it at the start). Stable, so it runs once. */
const caretEnd = (el: HTMLTextAreaElement | null) => { if (el) el.setSelectionRange(el.value.length, el.value.length); };

const escNotice = (t: Ticket) => cat(t) === 'payment' ? 'Payments always go to a person.' : cat(t) === 'merch' ? 'Physical goods always go to a person.' : 'This one goes to a person.';

function ModeChip({ t }: { t: Ticket }) {
  if (t.status === 'open') return t.run.status === 'failed' ? <div className="mode esc">Agent failed</div> : <div className="mode">Agent working</div>;
  if (t.status === 'replied') return <div className="mode done">Replied · not sent</div>;
  if (t.status === 'closed') return <div className="mode done">Closed</div>;
  if (t.handedOff) return <div className="mode">Handed off</div>;
  if (t.mode === 'escalate') return isPinned(t) ? <span /> : <div className="mode esc">Escalate · person only</div>;
  if (t.rejected) return <div className="mode">Draft rejected</div>;
  if (t.mode === 'auto') return <div className="mode auto">Auto · ready to send</div>;
  return <div className="mode">Assist · needs approval</div>;
}

const Att = ({ t }: { t: Ticket }) => <>{(t.attachments ?? []).map((a, i) => <span className="att" key={i}>{a.name}<span>{a.note}</span></span>)}</>;
const Act = ({ children, hint }: { children: ReactNode; hint?: string }) => <div className="act">{children}{hint && <span className="hint">{hint}</span>}</div>;

export function TicketPane({ t }: { t: Ticket }) {
  const { s, d, order, act, open } = useApp();
  const alarm = isPinned(t);
  const edit = () => d({ type: 'edit', blank: false });
  const write = () => d({ type: 'edit', blank: true });
  const more = <button className="btn more" onClick={e => open('more', e.currentTarget)}>···</button>;

  const extLink = t.channel === 'file' ? null : (
    <a className="ext" href="#" onClick={e => { e.preventDefault(); d({ type: 'notify', msg: `Opens the ${CHANNEL[t.channel]} link in a new tab (external_url)` }); }}>
      Open in {CHANNEL[t.channel]} ↗
    </a>
  );

  const inbound = (
    <div className="inb">
      <div className="inlab"><span className="lab">They wrote · <span className="mono" style={{ letterSpacing: 0, textTransform: 'none' }}>{t.ext}</span></span>{extLink}</div>
      {t.subject && <><b style={{ color: 'var(--tx)', fontWeight: 600 }}>{t.subject}</b><br /></>}
      {t.body.map((p, i) => <Fragment key={i}>{i > 0 && <br />}<Body text={p} /></Fragment>)}
      {t.attachments && <div><Att t={t} /></div>}
    </div>
  );

  const fresh = !t.draft || !!t.rejected || t.mode === 'escalate' || !!t.handedOff;
  const editor = (
    <div className="panel">
      <div className="phead"><span className="lab">{fresh ? 'Your reply' : 'Editing draft'} · {(t.lang && LANG[t.lang]) || 'English'}</span><span className="sub">Signed “— Team Matiks” automatically</span></div>
      <div className="editor">
        <textarea id="editor" autoFocus ref={caretEnd} value={s.editText} onChange={e => d({ type: 'editText', text: e.target.value })}
          placeholder="Write the reply. Any number you use is checked against the evidence." />
        <div className="checks" id="checks">{checks(t, s.editText).map((c, i) => <span key={i} className={c.tone || undefined}>{c.text}</span>)}</div>
      </div>
      <Act hint="Recorded as an edit · sends nothing">
        <Btn k="⌘↵" pri onClick={() => act('save')}>{fresh ? 'Save reply' : 'Save & approve'}</Btn>
        <Btn k="Esc" className="quiet" onClick={() => d({ type: 'cancelEdit' })}>Cancel</Btn>
      </Act>
    </div>
  );

  function message() {
    const long = t.body.join(' ').length > 420;
    const from = t.channel === 'gmail' ? <>From <b><Pii raw={t.reporter.email} kind="email" /></b></>
      : t.channel === 'file' ? <>WhatsApp export · <b><Who t={t} /></b></> : <>ClickUp form · <b><Who t={t} /></b></>;
    return (
      <div className={'panel mail' + (alarm ? ' edge' : '')} style={{ marginTop: alarm ? 16 : 14 }}>
        <div className="phead"><span className="from">{from}</span><span style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}><span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>{t.ext}</span>{extLink}</span></div>
        {t.subject && <div className="subj">{t.subject}</div>}
        <div className={'mbody' + (long && !s.showFull ? ' clip' : '')}>{t.body.map((p, i) => <p key={i}><Body text={p} /></p>)}</div>
        <div className="more">
          {long && <><button onClick={() => d({ type: 'toggleFull' })}>{s.showFull ? 'Show less' : 'Show full message'}</button><kbd>Space</kbd></>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><Att t={t} /></span>
        </div>
        <Act>
          <Btn k="E" pri onClick={write}>Write reply</Btn>
          <Btn k="X" onClick={() => open('handoff')}>Hand off<span className="rt"> → {t.routing}</span></Btn>
          {more}
        </Act>
      </div>
    );
  }

  function draftPanel() {
    if (s.editing) return editor;
    const dr = t.draft;
    if (!dr) return null;
    const n = dr.body.filter(x => x[1] !== undefined).length;
    const routing = dr.routing ? <>Escalate<span className="rt"> → {dr.routing}</span></> : 'Escalate';
    const handoff = <Btn k="X" className="esc" onClick={() => open('handoff')}>{routing}</Btn>;
    return (
      <div className="panel">
        <div className="phead"><span className="lab">Draft reply · {LANG[dr.lang]}</span>
          {n ? <span className="ok">{n} value{n > 1 ? 's' : ''} match evidence</span> : <span className="sub">No numbers to check</span>}</div>
        {t.rejected && <div className="rejected">Rejected by {t.rejected.by}{t.rejected.reason ? ' · ' + t.rejected.reason : ''}. The ticket stays here until someone replies, hands it off or closes it.</div>}
        <div className="dtext" style={t.rejected ? { opacity: 0.55 } : undefined}>
          {dr.body.map(([txt, ev], i) => ev === undefined ? <Fragment key={i}>{txt}</Fragment> : (
            <span key={i} className={'mv' + (s.hot === ev ? ' hot' : '')} onMouseEnter={() => d({ type: 'hot', i: ev })} onMouseLeave={() => d({ type: 'hot', i: null })}>{txt}</span>
          ))}
          <span className="sig">— Team Matiks</span>
        </div>
        {t.rejected
          ? <Act><Btn k="E" pri onClick={write}>Write reply</Btn>{handoff}{more}</Act>
          : <Act>
              <Btn k="A" pri onClick={() => act('approve')}>Approve</Btn>
              <Btn k="E" onClick={edit}>Edit</Btn>
              <Btn k="R" onClick={() => open('reject')}>Reject</Btn>
              {handoff}{more}
            </Act>}
      </div>
    );
  }

  function agentState() {
    const r = t.run, failed = r.status === 'failed';
    return <>
      <div className="steps">{['classify', 'enrich', 'decide', 'draft', 'guardrail'].map(n => {
        const st = r.steps.find(x => x.step === n);
        const cls = st ? (st.status === 'fail' ? 'fail' : st.status === 'now' ? 'now' : 'done') : '';
        const em = st ? (st.status === 'fail' ? 'failed' : st.status === 'now' ? 'running…' : ((st.ms ?? 0) / 1000).toFixed(1) + 's') : '';
        return <span key={n} className={cls}>{cap(n)}<em>{em}</em></span>;
      })}</div>
      {inbound}
      {failed
        ? <><div className="err">{r.error}</div><p className="calm">The ticket stays open and the agent retries on its next pass (attempt {r.attempt} of 3). Nothing is lost.</p></>
        : <p className="calm">The draft appears here when the agent finishes. You don’t have to wait for it.</p>}
      {s.editing ? editor : (
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn k="E" onClick={write}>Write reply yourself</Btn>
          <Btn k="T" onClick={() => open('trace')}>Open trace</Btn>
        </div>
      )}
    </>;
  }

  function resolved() {
    return (
      <div className="panel">
        <div className="phead"><span className="lab">{t.final ? 'Reply recorded · not sent (dry-run)' : 'Closed without a reply'}</span><span className="sub">{t.final && t.lang ? LANG[t.lang] : ''}</span></div>
        {t.final && <div className="final">{t.final}</div>}
        <div className="phead" style={{ borderTop: '1px solid var(--line)' }}><span className="lab">History</span><span className="sub">from <span className="mono">actions</span></span></div>
        <ul className="tl">
          <li><i /><span>User wrote via {CHANNEL[t.channel]}</span><span>{received(t.ageMin)}</span></li>
          {t.history.map((h, i) => (
            <li key={i} className={h.h ? 'h' : undefined}><i /><span>{h.who === 'agent' ? 'Agent' : <b>{h.who}</b>} {h.act}{h.body ? ' · “' + h.body + '”' : ''}</span><span>+{h.after}</span></li>
          ))}
        </ul>
        {t.status === 'closed'
          ? <Act><Btn k="O" pri onClick={() => act('reopen')}>Reopen</Btn><Btn k="N" onClick={() => open('note')}>Add note</Btn></Act>
          : <Act><Btn k="C" onClick={() => open('close')}>Close</Btn><Btn k="N" onClick={() => open('note')}>Add note</Btn></Act>}
      </div>
    );
  }

  const i = order.indexOf(t.id);
  const pos = i >= 0
    ? <div className="pos"><span>{i + 1} of {order.length}</span><kbd>K</kbd><span className="pw">prev</span><kbd>J</kbd><span className="pw">next</span></div>
    : <span />;
  const sub = [whoKey(t)[0] && <Who key="who" t={t} />, CHANNEL[t.channel], t.lang && LANG[t.lang], t.appVersion && 'v' + t.appVersion, t.screen && t.screen + ' screen',
    t.channel === 'gmail' && t.ageMin > 120 ? 'received ' + received(t.ageMin) : ageLong(t.ageMin)].filter(Boolean);

  const notes = (t.notes ?? []).map((n, k) => <div className="note" key={k}><b>Note · {n.by}</b> {n.text}</div>);
  let body: ReactNode;
  if (t.status === 'open') body = agentState();
  else if (t.status === 'replied' || t.status === 'closed') body = <>{inbound}{notes}{resolved()}</>;
  else if (t.handedOff) body = <>
    {inbound}{notes}
    <div className="note" style={{ borderLeftColor: 'var(--tx)' }}><b>Handed off to {t.handedOff.to}</b> by {t.handedOff.by}{t.handedOff.text ? ' · “' + t.handedOff.text + '”' : ''}. It stays open until someone replies or closes it.</div>
    {s.editing ? editor : <Act><Btn k="E" pri onClick={write}>Write reply</Btn>{more}</Act>}
  </>;
  else if (t.mode === 'escalate') body = <>
    {!alarm && <div className="note" style={{ borderLeftColor: 'var(--red)', marginTop: 18 }}><b>{escNotice(t)}</b> Reply yourself, or hand it to {t.routing}.</div>}
    {notes}
    {s.editing ? <>{inbound}{editor}</> : message()}
  </>;
  else body = <>{inbound}{notes}{draftPanel()}</>;

  return (
    <section className={'c' + (alarm ? ' alarm' : '')}>
      {alarm && (
        <div className="alarmband"><span className="pdot" /><div><div className="t">Safety report · person only</div><div className="d">The agent will not reply. Read it, then reply or hand it off.</div></div>
          <div className="w"><b>{waitBig(t.ageMin)}</b><span>waiting{isOldestTriaged(s.tickets, t) ? ' · oldest open ticket' : ''}</span></div></div>
      )}
      <div className="chead">
        <h1 className="title">{label(t)}</h1>
        <ModeChip t={t} />
        <div className="sub">{sub.map((x, k) => <Fragment key={k}>{k > 0 && ' · '}{x}</Fragment>)}</div>
        {pos}
      </div>
      {t.sourceStatus === 'in progress' && t.status === 'triaged' && (
        <div className="warnbox" style={{ margin: '16px 0 0' }}><b>Already in progress in ClickUp.</b> Someone at Matiks may be handling this task. Check before you approve.</div>
      )}
      {body}
    </section>
  );
}

export function EmptyPane() {
  const { counts: c } = useApp();
  return <>
    <section className="c" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div className="title" style={{ fontSize: 22 }}>All clear</div>
      <p className="calm" style={{ marginTop: 8 }}>Nothing in this view needs you. The agent is working on {c.running} ticket{c.running === 1 ? '' : 's'}{c.failed ? ` and retrying ${c.failed}` : ''}.</p>
    </section>
    <aside className="f" />
  </>;
}
