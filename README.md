# Matiks hackathon 2 — support console design

UI/UX design for the console of the Matiks AI support agent (hackathon, 3 Oct 2026). The console sits on the `support` database through the Go `support-api`. It shows a priority queue of tickets from ClickUp, Gmail and file imports, each with an AI draft, its evidence, confidence and cost. A person approves, edits, rejects, hands off or closes each one. Everything is dry-run: a decision only writes an `actions` row and nothing is ever sent.

Every name, ticket and number in here is invented sample data, shaped like the real schema.

## Run the prototype

```sh
python3 -m http.server 8765
# open http://localhost:8765/prototype/
```

It's plain HTML, CSS and JS with no build step. It has light and dark themes, and every touchpoint works: actions, undo, filters, ⌘K jump, the trace drawer, Insights and Evals. A ticket finishes classifying live a few seconds after load, the way an SSE update would land. Press `?` for the shortcuts.

## Files

| File | What it is |
|---|---|
| `prototype/` | **The clickable prototype.** `index.html`, `app.css` (both themes as tokens), `data.js` (schema-shaped mock data), `app.js` |
| `prototype/flow.html` | **The admin flow:** every touchpoint, what it does, what it writes, and where it leads |
| `index.html` | Static Dispatch v4 mockup (before the schema) |
| `explorations/` | Earlier directions and iterations: the three visual directions, v2, v3 |

## Design rules

- **Layout follows the work.** Three columns: pick a ticket → read and decide → check why it's safe.
- **One focal point.** The draft is the only raised panel, and the primary action is the only solid button.
- **Color means state, nothing else.** Red = escalate / critical. Amber = data warning. Green = verified, auto or healthy. Everything else is grayscale, in both themes.
- **Each font has one job.** JetBrains Mono for IDs, times, sources and keys. Condensed Archivo for numbers and labels. Regular Archivo for reading.
- **The open ticket is a tab.** Its queue row joins the ticket pane and shows the live handling timer.
- **The user panel never changes shape.** Streak and paying, bright only when they put the user in a priority group. Unknown is shown as unknown, never as "not paying".
- **The ranking is the real one.** `priority_score` (paying 200, 100+ streak 100, streak ÷ 10) is shown as a breakdown. Safety reports are pinned above it, and the pin says why.
- **Evidence is checkable.** Values in the draft that match evidence are highlighted and linked to their source. The editor flags numbers that aren't in the evidence, replies over five sentences, and promises.
- **Keyboard first.** J/K, A, E, R, X, C, N, O, Z, T, ⌘K, ⇧A.
- **Accessibility floor.** Text is at least 11px, secondary text has at least 4.5:1 contrast, and motion stops when the OS asks for reduced motion.

## Open items

Assumptions that need the devs (round 2 questions):
- Auto drafts need one click.
- Reopen goes back to `triaged`.
- Reject doesn't re-run the agent.
- The guardrail doesn't re-check edited replies.
- Eval results have a storage location.

The React build starts once the API contract is in.
