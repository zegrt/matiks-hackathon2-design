# Dispatch — Matiks support console

The React build of the design in `../prototype`. Vite + React 19 + TypeScript (strict), no runtime dependencies beyond React.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # reducer + ranking + checks + masking (node:test, no extra deps)
npm run build
```

## Layout

| Path | What it is |
|---|---|
| `src/types.ts` | Domain types named after the `support` schema |
| `src/api.ts` | **The only door to the backend.** `SupportApi` interface + the mock. Swap `mockApi` for a `fetch` client against `support-api` and nothing else changes |
| `src/reducer.ts` | The whole state machine, pure. Every decision (approve, edit, reject, hand off, close, note, reopen, approve-all, undo) is one case |
| `src/state.tsx` | Provider: loads data, subscribes to live updates, sends each decision to `api.recordAction`, exposes `useApp()` |
| `src/hotkeys.ts` | The global keyboard map |
| `src/lib/` | Pure logic: queue grouping and order, priority breakdown, editor checks, PII masking, formatting |
| `src/components/` | TopBar, Queue, Ticket, Facts, TraceDrawer, Insights, Evals, and `overlays/` (palette, filter, channels, more menu, dialogs, keys sheet, toast) |
| `src/styles/app.css` | Both themes as tokens; same class names as the prototype |
| `public/flow.html` | The admin flow map, linked from the `?` sheet |

## Wiring the real API

Implement `SupportApi` in `src/api.ts`:
- `tickets()`, `channels()`, `insights()`, `evals()` → the read endpoints.
- `recordAction(id, { action, draftId, body }, actor)` → POST one `actions` row, with `actor` sent as `X-Actor`.
- `subscribe(onTicket)` → the SSE stream; call `onTicket` with each updated ticket.

Open questions that change behavior, with what the console assumes today, are listed at the end of `public/flow.html`. The main one: do auto drafts need a click?
