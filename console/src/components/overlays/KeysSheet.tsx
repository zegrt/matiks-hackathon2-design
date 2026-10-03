import { useApp } from '../../state';

const KEYS = [
  ['Next / previous ticket', 'J / K'], ['Approve', 'A'], ['Edit or write reply', 'E'], ['Reject draft', 'R'], ['Escalate / hand off', 'X'], ['Close ticket', 'C'], ['Add note', 'N'], ['Reopen', 'O'],
  ['Undo last action', 'Z'], ['Approve all auto-ready', '⇧A'], ['Pipeline trace', 'T'], ['Show full message', 'Space'], ['Jump to anything', '⌘K'], ['Filters', 'F'], ['Mask PII', 'M'], ['Queue / Insights / Evals', '1 2 3'],
  ['Save in editor', '⌘↵'], ['Close or cancel', 'Esc'], ['Demo: simulate offline', '⇧O'], ['This sheet', '?'],
];

export function KeysSheet() {
  const { d } = useApp();
  return (
    <>
      <div className="scrim" onClick={() => d({ type: 'close' })} />
      <div className="pop keys">
        <h5>Keyboard</h5><p className="sm">Everything in the queue works without a mouse.</p>
        <div className="cols">{KEYS.map(([l, k]) => <div className="k" key={l}><span>{l}</span><kbd>{k}</kbd></div>)}</div>
        <p className="sm" style={{ marginTop: 14 }}><a href="/flow.html" style={{ color: 'var(--tx)' }}>See the whole admin flow, touchpoint by touchpoint →</a></p>
      </div>
    </>
  );
}
