import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './state';
import { useHotkeys } from './hotkeys';
import { TopBar, OfflineBanner } from './components/TopBar';
import { Queue } from './components/Queue';
import { TicketPane, EmptyPane } from './components/Ticket';
import { Facts } from './components/Facts';
import { Insights } from './components/Insights';
import { Evals } from './components/Evals';
import { Overlays } from './components/overlays/Overlays';

export default function App() {
  return <AppProvider><Shell /></AppProvider>;
}

function Shell() {
  const { s, cur } = useApp();
  useHotkeys();
  return (
    <div id="app">
      <TopBar />
      {s.offline ? <OfflineBanner /> : <div />}
      {!s.loaded ? <div className="empty" style={{ border: 0 }}>Loading tickets…</div>
        : s.view === 'queue' ? (
          <main className="work">
            <Queue />
            {cur ? <><TicketPane t={cur} /><Facts t={cur} /></> : <EmptyPane />}
          </main>
        ) : s.view === 'insights' ? <Insights /> : <Evals />}
      <Overlays />
      <Tooltip />
    </div>
  );
}

/** Chart tooltips: any element with data-tip gets one, so charts stay plain markup. */
function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const el = (e.target as Element).closest?.('[data-tip]') as HTMLElement | null;
      setTip(el ? { text: el.dataset.tip!, x: e.clientX, y: e.clientY } : null);
    };
    document.addEventListener('mousemove', move);
    return () => document.removeEventListener('mousemove', move);
  }, []);
  if (!tip) return null;
  return <div className="tip" style={{ left: Math.min(tip.x + 14, innerWidth - 320), top: tip.y + 16 }}>{tip.text}</div>;
}
