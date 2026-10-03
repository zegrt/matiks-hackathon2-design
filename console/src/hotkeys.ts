// Global keyboard map. The palette and dialogs handle their own keys; everything else lands here.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useApp, type DialogKind } from './state';

const DIALOGS: DialogKind[] = ['name', 'reject', 'handoff', 'close', 'note', 'approveAll'];
const PASS_THROUGH = ['more', 'filter', 'channels', 'trace', 'keys'];

export function useHotkeys() {
  const app = useApp();
  const ref = useRef(app);
  useLayoutEffect(() => { ref.current = app; });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { s, d, cur: t, groups, act, open } = ref.current;
      const k = e.key, mod = e.metaKey || e.ctrlKey;
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if (mod && k.toLowerCase() === 'k') { e.preventDefault(); open('palette'); return; }
      if (s.overlay === 'palette') return;
      if (k === 'Escape') {
        if (s.overlay) d({ type: 'close' });
        else if (s.editing) d({ type: 'cancelEdit' });
        return;
      }
      if (s.overlay && (DIALOGS as string[]).includes(s.overlay)) return;
      if (mod && k === 'Enter' && s.editing && t) { e.preventDefault(); act('save'); return; }
      if (typing || mod || e.altKey) return;
      if (s.overlay && !PASS_THROUGH.includes(s.overlay)) return;

      const canDraft = !!t && t.status === 'triaged' && !t.handedOff && !!t.draft && t.mode !== 'escalate';
      let handled = true;
      switch (k) {
        case 'j': if (s.view === 'queue') d({ type: 'move', delta: 1 }); break;
        case 'k': if (s.view === 'queue') d({ type: 'move', delta: -1 }); break;
        case 'a': if (canDraft && !t!.rejected && !s.editing) act('approve'); break;
        case 'A': if (s.view === 'queue' && groups.some(g => g.key === 'auto')) open('approveAll'); break;
        case 'e':
          if (t && !s.editing) {
            if (canDraft && !t.rejected) d({ type: 'edit', blank: false });
            else if (t.status === 'triaged' || t.status === 'open') d({ type: 'edit', blank: true });
          }
          break;
        case 'r': if (canDraft && !t!.rejected) open('reject'); break;
        case 'x': if (t && t.status === 'triaged' && !t.handedOff) open('handoff'); break;
        case 'c': if (t && (t.status === 'triaged' || t.status === 'replied')) open('close'); break;
        case 'n': if (t) open('note'); break;
        case 'o': if (t && t.status === 'closed') act('reopen'); break;
        case 't': if (t) open('trace'); break;
        case 'z': if (s.toast?.undo) d({ type: 'undo' }); break;
        case 'f': if (s.view === 'queue') open('filter', document.querySelector('[data-anchor="filter"]')); break;
        case 'm': d({ type: 'toggleMask' }); break;
        case ' ': if (t && !s.editing) d({ type: 'toggleFull' }); else handled = false; break;
        case '1': d({ type: 'view', view: 'queue' }); break;
        case '2': d({ type: 'view', view: 'insights' }); break;
        case '3': d({ type: 'view', view: 'evals' }); break;
        case '?': open('keys'); break;
        case 'O': d({ type: 'toggleOffline' }); break;
        default: handled = false;
      }
      if (handled) e.preventDefault(); // a shortcut never types into the field it opens
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
