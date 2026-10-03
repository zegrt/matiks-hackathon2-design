import { CHANNEL } from '../../data/mock';
import { useApp } from '../../state';
import type { Ticket } from '../../types';

export function MoreMenu({ t }: { t: Ticket }) {
  const { s, d, open } = useApp();
  const a = s.anchor ?? { left: 300, top: 120, right: 600, bottom: 140 };
  return (
    <>
      <div className="scrim" style={{ background: 'transparent' }} onClick={() => d({ type: 'close' })} />
      <div className="pop menu" style={{ bottom: innerHeight - a.top + 6, left: a.right - 210 }}>
        {t.status !== 'closed' && <button onClick={() => open('close')}>Close without replying<kbd>C</kbd></button>}
        <button onClick={() => open('note')}>Add internal note<kbd>N</kbd></button>
        <button onClick={() => open('trace')}>Open pipeline trace<kbd>T</kbd></button>
        {t.channel !== 'file' && <button onClick={() => d({ type: 'notify', msg: `Opens the ${CHANNEL[t.channel]} link in a new tab (external_url)` })}>Open in {CHANNEL[t.channel]} ↗</button>}
      </div>
    </>
  );
}
