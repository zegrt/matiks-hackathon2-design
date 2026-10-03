import { useApp, type View } from '../state';
import { initials, money } from '../lib/format';
import { MoonIcon, SunIcon } from './ui';

const NAV: [View, string][] = [['queue', 'Queue'], ['insights', 'Insights'], ['evals', 'Evals']];

export function TopBar() {
  const { s, d, open } = useApp();
  const k = s.insights?.kpi;
  const chOk = !s.offline, dark = s.theme === 'dark';
  const insights = () => d({ type: 'view', view: 'insights' });
  return (
    <header className="top">
      <div className="brand"><i />Dispatch</div>
      <nav className="nav">{NAV.map(([v, l]) =>
        <button key={v} className={s.view === v ? 'on' : ''} onClick={() => d({ type: 'view', view: v })}>{l}</button>)}</nav>
      <button className="search" onClick={() => open('palette')} title="Jump to ticket or user (⌘K)"><span className="txt">Jump to ticket or user</span><kbd>⌘K</kbd></button>
      <div className="stats">
        <button className="stat" onClick={insights} title="Median time from the user writing in to the first human action (assist mode, last 7 days)"><b>{k ? k.firstAction : '–'}</b><span className="lbl">to first action</span></button>
        <button className="stat" onClick={insights} title="Total LLM cost ÷ replied or closed tickets, last 7 days"><b>{k ? money(k.costPerResolved) : '–'}</b><span className="lbl">per resolved</span></button>
        <div className="sep" />
        <div className="sys">
          <button className={`live ${chOk ? '' : 'off'}`} onClick={e => open('channels', e.currentTarget)}><i /><span className="txt">{chOk ? '3 channels live' : 'Offline'}</span></button>
          <button className="mask" onClick={() => d({ type: 'toggleMask' })} title="Mask names, emails and phone numbers (M)"><span className={`sw ${s.mask ? 'on' : ''}`} /><span className="txt">Mask PII</span></button>
          <span className="dry" title="Approving only records a decision. No code path sends mail, posts to ClickUp or messages a user."><i />Dry-run</span>
          <button className="iconbtn" onClick={() => d({ type: 'toggleTheme' })} title={`${dark ? 'Light' : 'Dark'} mode`}>{dark ? <SunIcon /> : <MoonIcon />}</button>
          <button className="iconbtn" onClick={() => open('keys')} title="Keyboard shortcuts (?)">?</button>
          <button className="me" onClick={() => open('name')} title={s.actor || 'Set your name'}>{initials(s.actor)}</button>
        </div>
      </div>
    </header>
  );
}

export function OfflineBanner() {
  const { d } = useApp();
  return (
    <div className="banner"><b>Offline.</b> Showing data from 14:52. Actions you take are queued and saved when the connection returns.<button className="ext" onClick={() => d({ type: 'toggleOffline' })} style={{ marginLeft: 'auto' }}>Retry now</button></div>
  );
}
