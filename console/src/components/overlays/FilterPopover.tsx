import { CHANNEL, LANG } from '../../data/mock';
import { cap } from '../../lib/format';
import type { FilterKey } from '../../lib/tickets';
import { useApp } from '../../state';

const GROUPS: [FilterKey, string, [string, string][]][] = [
  ['channel', 'Channel', [['clickup', 'ClickUp'], ['gmail', 'Gmail'], ['file', 'File']]],
  ['category', 'Category', [['streak', 'Streak'], ['account', 'Account'], ['gameplay', 'Gameplay'], ['rating', 'Rating'], ['subscription', 'Subscription'], ['payment', 'Payment'], ['merch', 'Merch'], ['safety', 'Safety'], ['suggestion', 'Suggestion']]],
  ['mode', 'Mode', [['assist', 'Assist'], ['escalate', 'Escalate'], ['auto', 'Auto']]],
  ['lang', 'Language', [['en', 'English'], ['hi-Latn', 'Hinglish'], ['hi', 'Hindi']]],
];

const NAMES: Record<string, string> = { ...CHANNEL, ...LANG };
export const filterLabel = (v: string) => NAMES[v] ?? cap(v);

export function FilterPopover() {
  const { s, d } = useApp();
  const a = s.anchor ?? { left: 300, top: 120, right: 600, bottom: 140 };
  return (
    <>
      <div className="scrim" style={{ background: 'transparent' }} onClick={() => d({ type: 'close' })} />
      <div className="pop filterpop" style={{ top: a.bottom + 6, left: Math.max(8, Math.min(innerWidth - 352, a.left)) }}>
        {GROUPS.map(([k, l, os]) => (
          <div className="fg" key={k}><span className="lab">{l}</span><div className="opts">{os.map(([v, n]) =>
            <button key={v} className={s.filters[k].includes(v) ? 'on' : ''} onClick={() => d({ type: 'toggleFilter', key: k, value: v })}>{n}</button>)}</div></div>
        ))}
      </div>
    </>
  );
}
