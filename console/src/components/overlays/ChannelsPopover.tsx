import { CHANNEL } from '../../data/mock';
import { useApp } from '../../state';

export function ChannelsPopover() {
  const { s, d } = useApp();
  const a = s.anchor ?? { left: 300, top: 120, right: 600, bottom: 140 };
  return (
    <>
      <div className="scrim" style={{ background: 'transparent' }} onClick={() => d({ type: 'close' })} />
      <div className="pop chanpop" style={{ top: a.bottom + 8, right: innerWidth - a.right }}>
        <h5>Channels</h5><p className="sm" style={{ marginBottom: 8 }}>Polled every 2 minutes. A cursor only advances after every row in a page is stored.</p>
        {s.channels.map(c => (
          <div className="chan" key={c.name}><i className={s.offline ? 'w' : ''} /><b>{CHANNEL[c.name]}</b><span className="n">{c.today} this week</span>
            <span className="s">{c.kind} · last success {s.offline ? 'unknown' : c.lastSuccess}</span>
            {c.note && <span className="s" style={{ color: 'var(--tx2)' }}>{c.note}</span>}</div>
        ))}
      </div>
    </>
  );
}
