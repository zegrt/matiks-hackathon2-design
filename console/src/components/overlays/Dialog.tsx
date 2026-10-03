import { useEffect, useRef, useState } from 'react';
import { label } from '../../lib/tickets';
import { useApp, type DialogKind } from '../../state';
import { Who } from '../ui';

const REJECT = ['Wrong facts', 'Wrong tone', 'Wrong language', 'Should be escalated', 'Other'];
const CLOSE = ['Spam', 'Duplicate', 'Resolved elsewhere', 'No reply needed'];

/** Mount with key={kind} so the reason and text reset per dialog. */
export function Dialog({ kind }: { kind: DialogKind }) {
  const { s, d, cur: t, groups, act, approveAll } = useApp();
  const [reason, setReason] = useState<string>();
  const [text, setText] = useState(kind === 'name' ? s.actor || '' : '');
  const inRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inRef.current;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, []);

  function confirm() {
    if (kind === 'name') return d({ type: 'setActor', name: text });
    if (kind === 'approveAll') return approveAll();
    if (!t || (kind === 'note' && !text.trim())) return;
    act(kind, { reason, text });
  }
  // Enter confirms unless typing in a textarea; ⌘↵ always does. The global hotkeys skip dialogs.
  const confirmRef = useRef(confirm);
  useEffect(() => { confirmRef.current = confirm; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (e.metaKey || e.ctrlKey || (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); confirmRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const opts = (list: string[]) => (
    <div className="opts">{list.map(x =>
      <button key={x} className={reason === x ? 'on' : ''} onClick={() => { setReason(reason === x ? undefined : x); inRef.current?.focus(); }}>{x}</button>)}</div>
  );
  const area = (placeholder: string) => <textarea ref={inRef} placeholder={placeholder} value={text} onChange={e => setText(e.target.value)} />;
  const foot = (lbl: string) => (
    <div className="row2"><button className="btn quiet" onClick={() => d({ type: 'close' })}>Cancel</button><button className="btn pri" onClick={confirm}>{lbl} <kbd>↵</kbd></button></div>
  );

  let body;
  if (kind === 'name') body = <>
    <h5>What should we call you?</h5><p className="sm">Your name goes on every decision you make here, so the team can see who approved what. There are no logins; it’s sent as <span className="mono">X-Actor</span>.</p>
    <input type="text" ref={inRef} value={text} onChange={e => setText(e.target.value)} placeholder="Your name" />{foot('Continue')}</>;
  else if (kind === 'reject') body = <>
    <h5>Reject this draft?</h5><p className="sm">The ticket stays in To review. Pick what was wrong; it’s saved with the rejection.</p>
    {opts(REJECT)}{area('Anything else (optional)')}{foot('Reject draft')}</>;
  else if (kind === 'handoff') body = <>
    <h5>Hand off to {t?.draft?.routing || t?.routing || 'the owning team'}</h5><p className="sm">Records an escalation. The ticket leaves your list and waits under Handed off. Nothing is sent to the user.</p>
    {area('Note for them (optional)')}{foot('Hand off')}</>;
  else if (kind === 'close') body = <>
    <h5>Close without replying?</h5><p className="sm">The user gets nothing. Use this for spam, duplicates and messages that need no answer.</p>
    {opts(CLOSE)}{foot('Close ticket')}</>;
  else if (kind === 'note') body = <>
    <h5>Internal note</h5><p className="sm">Only people using this console see it. It’s saved as a <span className="mono">note</span> action and doesn’t change the status.</p>
    {area('What should the next person know?')}{foot('Save note')}</>;
  else {
    const auto = groups.find(g => g.key === 'auto')?.items ?? [];
    body = <>
      <h5>Approve {auto.length} auto-ready repl{auto.length === 1 ? 'y' : 'ies'}?</h5><p className="sm">Each draft is on the auto-resolve list with confidence 0.90 or higher. They’re recorded as approved by you. Nothing is sent.</p>
      <ul className="tl" style={{ padding: '10px 0 0' }}>{auto.map(x => <li key={x.id}><i /><span>{label(x)} · <Who t={x} /></span><span>{x.confidence?.toFixed(2)}</span></li>)}</ul>
      {foot('Approve all')}</>;
  }

  return (
    <>
      <div className="scrim" onClick={() => d({ type: 'close' })} />
      <div className="pop modal dialog">{body}</div>
    </>
  );
}
