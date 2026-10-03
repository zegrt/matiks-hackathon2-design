import { useApp } from '../../state';
import { Kbd } from '../ui';

export function Toast() {
  const { s, d } = useApp();
  if (!s.toast) return null;
  return (
    <div className="toast"><span>{s.toast.msg}</span>
      {s.toast.undo && <><button onClick={() => d({ type: 'undo' })}>Undo</button><Kbd>Z</Kbd></>}</div>
  );
}
